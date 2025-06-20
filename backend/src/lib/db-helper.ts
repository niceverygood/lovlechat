import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';

// Vercel 최적화된 타임아웃 설정
const QUERY_TIMEOUT = isVercel ? 20000 : 8000; // 대폭 단축
const MUTATION_TIMEOUT = isVercel ? 25000 : 12000;
const MAX_RETRIES = isVercel ? 1 : 2; // 재시도 최소화

// 강화된 캐싱 시스템 (메모리 최적화)
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_CLEANUP_INTERVAL = 3 * 60 * 1000; // 3분마다 정리
const MAX_CACHE_SIZE = isVercel ? 30 : 60; // 캐시 크기 제한

// 최적화된 재시도 헬퍼
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      await sleep(500); // 짧은 대기
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
}

function shouldRetry(error: any): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
  return retryableCodes.includes(error.code) || 
         error.message?.includes('TIMEOUT');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 최적화된 캐시 정리
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      queryCache.delete(key);
      cleaned++;
    }
  }
  
  // 크기 제한 초과 시 오래된 항목 제거 (LRU)
  if (queryCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(queryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = queryCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      queryCache.delete(sortedEntries[i][0]);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 캐시 정리: ${cleaned}개 항목 삭제`);
  }
}, CACHE_CLEANUP_INTERVAL);

// 캐시 키 생성 (최적화)
function createCacheKey(query: string, params: any[]): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  return `${normalizedQuery}|${JSON.stringify(params)}`;
}

// 쿼리 로깅 최적화 (문자 잘림 방지)
function logQuery(query: string, params: any[] = []) {
  if (!isProduction) {
    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    console.log('🔍 Executing query:', { 
      query: cleanQuery, 
      params: params.slice(0, 3) // 파라미터 제한
    });
  }
}

// 기본 쿼리 실행 (대폭 최적화)
export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  const startTime = Date.now();
  
  return withRetry(async () => {
    logQuery(query, params);
    
    const pool = await getPool();
    const [rows] = await pool.execute(query, params) as [RowDataPacket[], any];
    const executionTime = Date.now() - startTime;
    
    if (!isProduction) {
      console.log(`✅ Query result count: ${Array.isArray(rows) ? rows.length : 0}`);
    }
    
    return Array.isArray(rows) ? rows : [];
  });
}

// 캐싱이 적용된 쿼리 실행 (강화)
export async function executeQueryWithCache(
  query: string, 
  params: any[] = [], 
  ttlSeconds: number = 300 // 기본 5분으로 증가
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
  
  // 캐시 미스 - DB에서 조회
  try {
    const result = await executeQuery(query, params);
    
    // 결과 캐싱 (성공한 경우에만)
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
    // 에러 발생 시 캐시된 데이터가 있다면 사용 (Stale-While-Revalidate)
    if (cached) {
      console.warn(`⚠️ Using stale cache due to error`);
      return cached.data;
    }
    throw error;
  }
}

// 변경 쿼리 실행 (INSERT, UPDATE, DELETE) 최적화
export async function executeMutation(query: string, params: any[] = []): Promise<{ 
  affectedRows: number; 
  insertId?: number;
  success: boolean;
}> {
  return withRetry(async () => {
    logQuery(query, params);
    
    const pool = await getPool();
    const [result] = await pool.execute(query, params) as [ResultSetHeader, any];
    
    // 관련 캐시 무효화 (테이블명 기준)
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

// 테이블명 추출 최적화
function extractTableName(query: string): string | null {
  const match = query.match(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+`?(\w+)`?/i);
  return match ? match[1] : null;
}

// 테이블별 캐시 무효화 (성능 최적화)
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
      await connection.execute(query, params);
    }
    
    await connection.commit();
    
    // 관련 캐시 무효화
    for (const { query } of operations) {
      const tableName = extractTableName(query);
      if (tableName) {
        invalidateTableCache(tableName);
      }
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

// 배치 INSERT 함수 최적화
export async function executeBatchInsert(
  tableName: string,
  columns: string[],
  values: any[][]
): Promise<void> {
  if (values.length === 0) return;
  
  const placeholders = columns.map(() => '?').join(', ');
  const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values.map(() => `(${placeholders})`).join(', ')}`;
  const flatParams = values.flat();
  
  await executeMutation(query, flatParams);
}

// 안전한 JSON 파싱 최적화
export function parseJsonSafely(jsonString: any): any {
  if (!jsonString) return null;
  if (typeof jsonString === 'object') return jsonString;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    const trimmed = jsonString.trim();
    if (!trimmed) return null;
    
    // JSON이 아닌 단순 문자열일 가능성 체크
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
      return trimmed;
    }
    
    return JSON.parse(trimmed);
  } catch (error: any) {
    return jsonString;
  }
}

// 헬스 체크 최적화
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
    hitRate: '계산 중...', // 추후 구현
    environment: isVercel ? 'vercel' : 'local'
  };
}

// 캐시 초기화
export function clearCache(): void {
  const size = queryCache.size;
  queryCache.clear();
  console.log(`🧹 Cache cleared: ${size} entries removed`);
} 