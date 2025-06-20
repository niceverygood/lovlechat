import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';

// 최적화된 타임아웃 설정
const QUERY_TIMEOUT = isVercel ? 15000 : 10000;
const MAX_RETRIES = isVercel ? 1 : 2;

// 강화된 캐싱 시스템
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5분마다 정리
const MAX_CACHE_SIZE = isVercel ? 25 : 50;

// 진행 중인 쿼리 추적 (중복 방지)
const pendingQueries = new Map<string, Promise<any>>();

// 최적화된 재시도 로직
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }
      await sleep(Math.min(500 * Math.pow(2, attempt), 2000)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}

function shouldRetry(error: any): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ER_LOCK_WAIT_TIMEOUT'];
  return retryableCodes.includes(error.code) || 
         error.message?.includes('TIMEOUT') ||
         error.message?.includes('Connection lost');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  // 만료된 항목 제거
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      queryCache.delete(key);
      cleaned++;
    }
  }
  
  // LRU 기반 크기 제한
  if (queryCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(queryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = queryCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      queryCache.delete(sortedEntries[i][0]);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && !isProduction) {
    console.log(`🧹 캐시 정리: ${cleaned}개 항목 삭제`);
  }
}, CACHE_CLEANUP_INTERVAL);

// 캐시 키 생성
function createCacheKey(query: string, params: any[]): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  return `${normalizedQuery}|${JSON.stringify(params)}`;
}

// 쿼리 로깅 (완전 최적화)
function logQuery(query: string, params: any[] = []) {
  if (!isProduction) {
    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    // 긴 쿼리는 처음 100자만 표시
    const displayQuery = cleanQuery.length > 100 ? cleanQuery.substring(0, 100) + '...' : cleanQuery;
    console.log('🔍 Executing query:', { 
      query: displayQuery, 
      params: params.slice(0, 2) // 파라미터 제한
    });
  }
}

// 기본 쿼리 실행 (중복 방지 추가)
export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  const cacheKey = createCacheKey(query, params);
  
  // 진행 중인 동일 쿼리가 있으면 기다림
  if (pendingQueries.has(cacheKey)) {
    return pendingQueries.get(cacheKey);
  }

  const queryPromise = withRetry(async () => {
    logQuery(query, params);
    
    const pool = await getPool();
    const [rows] = await pool.execute(query, params) as [RowDataPacket[], any];
    
    if (!isProduction) {
      console.log(`✅ Query result count: ${Array.isArray(rows) ? rows.length : 0}`);
    }
    
    return Array.isArray(rows) ? rows : [];
  });

  pendingQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    return result;
  } finally {
    pendingQueries.delete(cacheKey);
  }
}

// 캐싱된 쿼리 실행 (개선)
export async function executeQueryWithCache(
  query: string, 
  params: any[] = [], 
  ttlSeconds: number = 300
): Promise<any[]> {
  const cacheKey = createCacheKey(query, params);
  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;
  
  // 캐시 확인
  const cached = queryCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cached.ttl) {
    if (!isProduction) {
      console.log(`⚡ Cache hit: ${cached.data.length} rows`);
    }
    return cached.data;
  }
  
  // 진행 중인 쿼리 확인
  if (pendingQueries.has(cacheKey)) {
    const result = await pendingQueries.get(cacheKey);
    return result;
  }
  
  const queryPromise = executeQuery(query, params);
  pendingQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 결과 캐싱
    queryCache.set(cacheKey, {
      data: result,
      timestamp: now,
      ttl: ttlMs
    });
    
    if (!isProduction) {
      console.log(`💾 Cached query result: ${result.length} rows for ${ttlSeconds}s`);
    }
    
    return result;
    
  } catch (error) {
    // 에러 시 stale 캐시 사용
    if (cached) {
      if (!isProduction) {
        console.warn(`⚠️ Using stale cache due to error`);
      }
      return cached.data;
    }
    throw error;
  } finally {
    pendingQueries.delete(cacheKey);
  }
}

// 변경 쿼리 실행 (최적화)
export async function executeMutation(query: string, params: any[] = []): Promise<{ 
  affectedRows: number; 
  insertId?: number;
  success: boolean;
}> {
  return withRetry(async () => {
    logQuery(query, params);
    
    const pool = await getPool();
    const [result] = await pool.execute(query, params) as [ResultSetHeader, any];
    
    // 관련 캐시 무효화
    const tableName = extractTableName(query);
    if (tableName) {
      invalidateTableCache(tableName);
    }
    
    if (!isProduction) {
      console.log(`✅ Mutation completed: ${result.affectedRows} rows affected`);
    }
    
    return {
      affectedRows: result.affectedRows || 0,
      insertId: result.insertId,
      success: true
    };
  });
}

// 테이블명 추출
function extractTableName(query: string): string | null {
  const match = query.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+`?(\w+)`?/i);
  return match ? match[1] : null;
}

// 테이블별 캐시 무효화
function invalidateTableCache(tableName: string): void {
  let invalidated = 0;
  const lowerTable = tableName.toLowerCase();
  
  for (const [key, _] of queryCache.entries()) {
    if (key.toLowerCase().includes(lowerTable)) {
      queryCache.delete(key);
      invalidated++;
    }
  }
  
  if (invalidated > 0 && !isProduction) {
    console.log(`🗑️ Invalidated ${invalidated} cache entries for table: ${tableName}`);
  }
}

// 트랜잭션 실행 (최적화)
export async function executeTransaction(operations: Array<{
  query: string;
  params: any[];
}>): Promise<boolean> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const { query, params } of operations) {
      logQuery(query, params);
      await connection.execute(query, params);
    }
    
    await connection.commit();
    
    // 관련 캐시 무효화
    const tables = new Set<string>();
    for (const { query } of operations) {
      const tableName = extractTableName(query);
      if (tableName) {
        tables.add(tableName);
      }
    }
    
    for (const table of tables) {
      invalidateTableCache(table);
    }
    
    if (!isProduction) {
      console.log(`✅ Transaction completed with ${operations.length} operations`);
    }
    
    return true;
    
  } catch (error: any) {
    await connection.rollback();
    console.error('❌ Transaction failed:', error.message);
    return false;
    
  } finally {
    connection.release();
  }
}

// 배치 INSERT (최적화)
export async function executeBatchInsert(
  tableName: string,
  columns: string[],
  values: any[][]
): Promise<void> {
  if (values.length === 0) return;
  
  const placeholders = columns.map(() => '?').join(', ');
  const valuesClauses = values.map(() => `(${placeholders})`).join(', ');
  const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuesClauses}`;
  const flatParams = values.flat();
  
  await executeMutation(query, flatParams);
}

// JSON 파싱 (안전)
export function parseJsonSafely(jsonString: any): any {
  if (!jsonString) return null;
  if (typeof jsonString === 'object') return jsonString;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    const trimmed = jsonString.trim();
    if (!trimmed) return null;
    
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
      return trimmed;
    }
    
    return JSON.parse(trimmed);
  } catch {
    return jsonString;
  }
}

// 헬스 체크
export async function healthCheck(): Promise<{ 
  database: boolean; 
  cache: boolean; 
  performance: string;
}> {
  const startTime = Date.now();
  
  try {
    await executeQuery('SELECT 1 as test');
    const responseTime = Date.now() - startTime;
    
    let performance = 'excellent';
    if (responseTime > 50) performance = 'good';
    if (responseTime > 150) performance = 'slow';
    if (responseTime > 500) performance = 'poor';
    
    return {
      database: true,
      cache: queryCache.size > 0,
      performance: `${performance} (${responseTime}ms)`
    };
    
  } catch (error) {
    return {
      database: false,
      cache: false,
      performance: 'error'
    };
  }
}

// 캐시 통계
export function getCacheStats() {
  return {
    size: queryCache.size,
    maxSize: MAX_CACHE_SIZE,
    pendingQueries: pendingQueries.size,
    environment: isVercel ? 'vercel' : 'local'
  };
}

// 캐시 초기화
export function clearCache(): void {
  const size = queryCache.size;
  queryCache.clear();
  pendingQueries.clear();
  if (!isProduction) {
    console.log(`🧹 Cache cleared: ${size} entries removed`);
  }
} 