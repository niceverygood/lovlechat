import { pool, warmupConnection } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';

// Vercel 최적화된 타임아웃 설정
const QUERY_TIMEOUT = isVercel ? 25000 : 10000; // Vercel: 25초, 로컬: 10초
const MUTATION_TIMEOUT = isVercel ? 30000 : 15000;
const MAX_RETRIES = isVercel ? 2 : 3;

// 강화된 캐싱 시스템
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5분마다 정리
const MAX_CACHE_SIZE = isVercel ? 50 : 100; // 캐시 크기 제한

// Vercel 웜업
if (isVercel) {
  warmupConnection().catch(console.warn);
}

// 재시도 헬퍼
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      if (isVercel) console.log(`🔄 재시도... ${retries}회 남음`);
      await sleep(Math.min(1000 * (MAX_RETRIES - retries + 1), 3000));
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
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

// 캐시 정리 (백그라운드)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      queryCache.delete(key);
      cleaned++;
    }
  }
  
  // 크기 제한 초과 시 오래된 항목 제거
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

// 캐시 키 생성
function createCacheKey(query: string, params: any[]): string {
  return `${query}|${JSON.stringify(params)}`;
}

// 기본 쿼리 실행 (최적화)
export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Executing query:', { 
      query: query.replace(/\s+/g, ' ').trim(),
      params 
    });
    
    const [rows] = await pool.execute(query, params) as [RowDataPacket[], any];
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Query result count: ${Array.isArray(rows) ? rows.length : 0} (${executionTime}ms)`);
    return Array.isArray(rows) ? rows : [];
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Query execution failed (${executionTime}ms):`, {
      error: error.message,
      query: query.substring(0, 100),
      params: params.slice(0, 5)
    });
    throw error;
  }
}

// 캐싱이 적용된 쿼리 실행 (강화)
export async function executeQueryWithCache(
  query: string, 
  params: any[] = [], 
  ttlSeconds: number = 180 // 기본 3분
): Promise<any[]> {
  const cacheKey = createCacheKey(query, params);
  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;
  
  // 캐시 확인
  const cached = queryCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cached.ttl) {
    console.log(`⚡ Cache hit: ${query.substring(0, 50)}... (${cached.data.length} rows)`);
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
    
    console.log(`💾 Cached query result: ${result.length} rows for ${ttlSeconds}s`);
    return result;
    
  } catch (error) {
    // 에러 발생 시 캐시된 데이터가 있다면 사용 (stale-while-revalidate)
    if (cached) {
      console.warn(`⚠️ Using stale cache due to error: ${error}`);
      return cached.data;
    }
    throw error;
  }
}

// 변경 쿼리 실행 (INSERT, UPDATE, DELETE)
export async function executeMutation(query: string, params: any[] = []): Promise<{ 
  affectedRows: number; 
  insertId?: number;
  success: boolean;
}> {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Executing mutation:', { 
      query: query.replace(/\s+/g, ' ').trim(),
      params 
    });
    
    const [result] = await pool.execute(query, params) as [ResultSetHeader, any];
    const executionTime = Date.now() - startTime;
    
    // 관련 캐시 무효화 (테이블명 기준)
    const tableName = extractTableName(query);
    if (tableName) {
      invalidateTableCache(tableName);
    }
    
    console.log(`✅ Mutation completed: ${result.affectedRows} rows affected (${executionTime}ms)`);
    
    return {
      affectedRows: result.affectedRows || 0,
      insertId: result.insertId,
      success: true
    };
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Mutation failed (${executionTime}ms):`, {
      error: error.message,
      query: query.substring(0, 100),
      params: params.slice(0, 5)
    });
    
    return {
      affectedRows: 0,
      success: false
    };
  }
}

// 테이블명 추출
function extractTableName(query: string): string | null {
  const match = query.match(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+`?(\w+)`?/i);
  return match ? match[1] : null;
}

// 테이블별 캐시 무효화
function invalidateTableCache(tableName: string): void {
  let invalidated = 0;
  
  for (const [key, _] of queryCache.entries()) {
    if (key.toLowerCase().includes(tableName.toLowerCase())) {
      queryCache.delete(key);
      invalidated++;
    }
  }
  
  if (invalidated > 0) {
    console.log(`🗑️ Invalidated ${invalidated} cache entries for table: ${tableName}`);
  }
}

// 트랜잭션 실행 (최적화)
export async function executeTransaction(operations: Array<{
  query: string;
  params: any[];
}>): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    console.log('🔄 Transaction started');
    
    for (const { query, params } of operations) {
      await connection.execute(query, params);
    }
    
    await connection.commit();
    console.log('✅ Transaction completed successfully');
    
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

// 캐시 통계 및 관리
export function getCacheStats() {
  return {
    size: queryCache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(queryCache.entries()).map(([key, value]) => ({
      key: key.substring(0, 50),
      age: Date.now() - value.timestamp,
      ttl: value.ttl
    }))
  };
}

// 캐시 초기화
export function clearCache(): void {
  const size = queryCache.size;
  queryCache.clear();
  console.log(`🧹 Cache cleared: ${size} entries removed`);
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
    if (responseTime > 100) performance = 'good';
    if (responseTime > 300) performance = 'slow';
    if (responseTime > 1000) performance = 'poor';
    
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

// 연결 상태 확인
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await executeQuery("SELECT 1 as connected");
    return true;
  } catch (error: any) {
    console.error('❌ DB connection check failed:', error.message);
    return false;
  }
}

// 성능 모니터링 (개발용)
export async function executeQueryWithMetrics(
  query: string,
  params: any[] = []
): Promise<{ data: any[], duration: number }> {
  const startTime = Date.now();
  
  try {
    const data = await executeQuery(query, params);
    const duration = Date.now() - startTime;
    
    // 느린 쿼리 경고
    const slowThreshold = isVercel ? 5000 : 2000;
    if (duration > slowThreshold) {
      console.warn(`⚠️ 느린 쿼리 (${duration}ms):`, query.substring(0, 50));
    }
    
    return { data, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query failed after ${duration}ms:`, error.message);
    throw error;
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
    // 빈 문자열이거나 단순 문자열인 경우 처리
    const trimmed = jsonString.trim();
    if (!trimmed) return null;
    
    // JSON이 아닌 단순 문자열일 가능성 체크
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
      return trimmed; // 단순 문자열로 반환
    }
    
    return JSON.parse(trimmed);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development' || isVercel) {
      console.warn('⚠️ JSON parsing failed:', { input: jsonString, error: error.message });
    }
    return jsonString; // 파싱 실패시 원본 반환
  }
} 