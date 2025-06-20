import { pool, warmupConnection } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';

// Vercel 최적화된 타임아웃 설정
const QUERY_TIMEOUT = isVercel ? 25000 : 10000; // Vercel: 25초, 로컬: 10초
const MUTATION_TIMEOUT = isVercel ? 30000 : 15000;
const MAX_RETRIES = isVercel ? 2 : 3;

// 쿼리 캐시 (메모리 최적화)
const queryCache = new Map<string, { data: any, expiry: number }>();
const MAX_CACHE_SIZE = isVercel ? 50 : 100;

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

// 메인 쿼리 실행 함수 (최적화됨)
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = [], 
  timeoutMs = QUERY_TIMEOUT
): Promise<T[]> {
  return withRetry(async () => {
    // 파라미터 정리
    const cleanParams = params.map(param => {
      if (param === undefined || param === null) return null;
      if (typeof param === 'object' && !Array.isArray(param)) return JSON.stringify(param);
      if (typeof param === 'string') return param.trim();
      return param;
    });

    if (isVercel && process.env.NODE_ENV === 'development') {
      console.log('🔍 Executing query:', { 
        query: query.substring(0, 80) + (query.length > 80 ? '...' : ''),
        params: cleanParams.slice(0, 3)
      });
    }

    return new Promise<T[]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms: ${query.substring(0, 50)}...`));
      }, timeoutMs);

      pool.query(query, cleanParams)
        .then(([rows]: [QueryResult, FieldPacket[]]) => {
          clearTimeout(timeoutId);
          const result = Array.isArray(rows) ? rows : [];
          
          if (isVercel && process.env.NODE_ENV === 'development') {
            console.log('✅ Query result count:', result.length);
          }
          
          resolve(result as T[]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`❌ Query failed:`, { 
            query: query.substring(0, 100),
            error: error.message,
            code: error.code 
          });
          reject(error);
        });
    });
  });
}

// 변경 작업 함수
export async function executeMutation(
  query: string, 
  params: any[] = [], 
  timeoutMs = MUTATION_TIMEOUT
): Promise<[ResultSetHeader, FieldPacket[]]> {
  return withRetry(async () => {
    const cleanParams = params.map(param => {
      if (param === undefined || param === null) return null;
      if (typeof param === 'object' && !Array.isArray(param)) return JSON.stringify(param);
      return param;
    });

    return new Promise<[ResultSetHeader, FieldPacket[]]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Mutation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      pool.query(query, cleanParams)
        .then((result) => {
          clearTimeout(timeoutId);
          if (isVercel) console.log('✅ Mutation completed');
          resolve(result as [ResultSetHeader, FieldPacket[]]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`❌ Mutation failed:`, { 
            query: query.substring(0, 50),
            error: error.message 
          });
          reject(error);
        });
    });
  });
}

// 트랜잭션 실행 (간단화)
export async function executeTransaction<T>(operations: (connection: any) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  
  try {
    await connection.query('START TRANSACTION');
    const result = await operations(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error: any) {
    await connection.query('ROLLBACK');
    console.error('❌ Transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// 캐시된 쿼리 실행
export async function executeQueryWithCache<T = any>(
  query: string,
  params: any[] = [],
  cacheSeconds = isVercel ? 300 : 180 // Vercel: 5분, 로컬: 3분
): Promise<T[]> {
  const cacheKey = `${query.substring(0, 100)}_${JSON.stringify(params)}`;
  
  // 캐시 확인
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    if (isVercel) console.log('🎯 Cache hit');
    return cached.data;
  }

  // 캐시 크기 관리
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }

  // DB 조회
  const data = await executeQuery<T>(query, params);
  
  // 캐시 저장
  queryCache.set(cacheKey, {
    data,
    expiry: Date.now() + (cacheSeconds * 1000)
  });

  if (isVercel) console.log('💾 Cached query result');
  return data;
}

// 연결 상태 확인
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await executeQuery("SELECT 1 as connected", [], 5000);
    return true;
  } catch (error: any) {
    console.error('❌ DB connection check failed:', error.message);
    return false;
  }
}

// 성능 모니터링 (개발용)
export async function executeQueryWithMetrics<T = any>(
  query: string,
  params: any[] = []
): Promise<{ data: T[], duration: number }> {
  const startTime = Date.now();
  
  try {
    const data = await executeQuery<T>(query, params);
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
  values: any[][],
  timeoutMs: number = MUTATION_TIMEOUT + 5000 // 추가 시간
): Promise<void> {
  if (values.length === 0) return;
  
  const placeholders = columns.map(() => '?').join(', ');
  const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values.map(() => `(${placeholders})`).join(', ')}`;
  const flatParams = values.flat();
  
  await executeMutation(query, flatParams, timeoutMs);
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

// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  for (const [key, value] of queryCache.entries()) {
    if (value.expiry < now) {
      queryCache.delete(key);
      deletedCount++;
    }
  }
  if (deletedCount > 0 && isVercel) {
    console.log(`🧹 Cleaned ${deletedCount} expired cache entries`);
  }
}, 60000); // 1분마다 정리 