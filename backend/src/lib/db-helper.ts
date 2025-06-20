import { pool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';

// 재시도 설정 최적화
const MAX_RETRIES = isVercel ? 3 : 2;
const RETRY_DELAY = isVercel ? 1000 : 500;

// 타임아웃 설정 (Vercel 환경에서 증가)
const DEFAULT_QUERY_TIMEOUT = isVercel ? 15000 : 3000; // Vercel: 15초, 로컬: 3초
const DEFAULT_MUTATION_TIMEOUT = isVercel ? 20000 : 5000; // Vercel: 20초, 로컬: 5초

// 재시도 헬퍼 함수 최적화
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      if (process.env.NODE_ENV === 'development' || isVercel) {
        console.log(`🔄 재시도... 남은 횟수: ${retries}, 에러: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 1.2);
    }
    throw error;
  }
}

// 재시도 가능한 에러 판단 최적화
function shouldRetry(error: any): boolean {
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_LOCK_DEADLOCK',
    'PROTOCOL_CONNECTION_LOST'
  ];
  
  if (isVercel) {
    console.error('🚨 Vercel DB 에러:', {
      code: error.code,
      message: error.message,
      sqlState: error.sqlState
    });
  }
  
  return retryableCodes.includes(error.code) || 
         error.message?.includes('TIMEOUT') ||
         error.message?.includes('Connection lost') ||
         error.message?.includes('connect ETIMEDOUT');
}

// 최적화된 쿼리 실행 함수 (SELECT용)
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT
): Promise<T[]> {
  return withRetry(async () => {
    return new Promise<T[]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`QUERY_TIMEOUT: ${timeoutMs}ms exceeded for query: ${query.substring(0, 100)}...`);
        console.error('⏰ Query timeout:', { 
          query: query.substring(0, 200), 
          timeoutMs, 
          isVercel,
          params: params.length 
        });
        reject(timeoutError);
      }, timeoutMs);

      // 파라미터 정리 및 검증 최적화
      const cleanParams = params.map(param => {
        if (param === undefined || param === null) return null;
        if (typeof param === 'object' && !Array.isArray(param)) {
          return JSON.stringify(param);
        }
        if (typeof param === 'string') {
          return param.trim();
        }
        return param;
      });

      if (isVercel || process.env.NODE_ENV === 'development') {
        console.log('🔍 Executing query:', { query: query.substring(0, 100), params: cleanParams });
      }

      pool.query(query, cleanParams)
        .then(([rows, fields]: [QueryResult, FieldPacket[]]) => {
          clearTimeout(timeoutId);
          if (isVercel || process.env.NODE_ENV === 'development') {
            console.log('✅ Query result count:', Array.isArray(rows) ? rows.length : 0);
          }
          resolve(rows as T[]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`❌ Query failed: ${query.substring(0, 100)}`, { 
            error: error.message,
            code: error.code,
            isVercel
          });
          reject(error);
        });
    });
  });
}

// 최적화된 변경 작업 함수 (INSERT, UPDATE, DELETE용)
export async function executeMutation(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = DEFAULT_MUTATION_TIMEOUT
): Promise<[ResultSetHeader, FieldPacket[]]> {
  return withRetry(async () => {
    return new Promise<[ResultSetHeader, FieldPacket[]]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`MUTATION_TIMEOUT: ${timeoutMs}ms exceeded for query: ${query.substring(0, 100)}...`);
        console.error('⏰ Mutation timeout:', { 
          query: query.substring(0, 200), 
          timeoutMs, 
          isVercel 
        });
        reject(timeoutError);
      }, timeoutMs);

      // 파라미터 정리 및 검증
      const cleanParams = params.map(param => {
        if (param === undefined || param === null) return null;
        if (typeof param === 'object' && !Array.isArray(param)) {
          return JSON.stringify(param);
        }
        return param;
      });

      pool.query(query, cleanParams)
        .then((result) => {
          clearTimeout(timeoutId);
          if (isVercel) {
            console.log('✅ Mutation completed successfully');
          }
          resolve(result as [ResultSetHeader, FieldPacket[]]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`❌ Mutation failed: ${query.substring(0, 100)}`, { 
            error: error.message,
            code: error.code,
            isVercel
          });
          reject(error);
        });
    });
  });
}

// 트랜잭션 실행 함수 최적화
export async function executeTransaction<T>(
  operations: (connection: any) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await operations(connection);
    await connection.commit();
    if (isVercel) {
      console.log('✅ Transaction completed successfully');
    }
    return result;
  } catch (error: any) {
    await connection.rollback();
    console.error('❌ Transaction failed:', {
      error: error.message,
      isVercel
    });
    throw error;
  } finally {
    connection.release();
  }
}

// 배치 INSERT 함수 최적화
export async function executeBatchInsert(
  tableName: string,
  columns: string[],
  values: any[][],
  timeoutMs: number = DEFAULT_MUTATION_TIMEOUT + 5000 // 추가 시간
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

// DB 연결 상태 확인 최적화
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await executeQuery("SELECT 1 as connected", [], isVercel ? 10000 : 2000);
    return Array.isArray(result) && result.length > 0;
  } catch (error: any) {
    console.error('❌ Database connection check failed:', {
      error: error.message,
      isVercel
    });
    return false;
  }
}

// 쿼리 성능 모니터링 최적화 (개발 환경 전용)
export async function executeQueryWithMetrics<T = any>(
  query: string,
  params: any[] = [],
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT
): Promise<{ data: T[], duration: number, query: string }> {
  const startTime = Date.now();
  
  try {
    const data = await executeQuery<T>(query, params, timeoutMs);
    const duration = Date.now() - startTime;
    
    // 느린 쿼리 감지 (Vercel에서는 더 관대하게)
    const slowQueryThreshold = isVercel ? 10000 : 2000;
    if ((process.env.NODE_ENV === 'development' || isVercel) && duration > slowQueryThreshold) {
      console.warn(`⚠️ 느린 쿼리 감지 (${duration}ms):`, query.substring(0, 100));
    }
    
    return { data, duration, query };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query failed after ${duration}ms:`, { 
      query: query.substring(0, 100), 
      error: error.message,
      isVercel
    });
    throw error;
  }
}

// 캐시를 위한 간단한 메모리 저장소 (소규모 데이터용)
const queryCache = new Map<string, { data: any, expiry: number }>();

// 캐시된 쿼리 실행 (읽기 전용 데이터용)
export async function executeQueryWithCache<T = any>(
  query: string,
  params: any[] = [],
  cacheSeconds: number = isVercel ? 600 : 300, // Vercel에서는 더 긴 캐시
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT
): Promise<T[]> {
  const cacheKey = `${query}_${JSON.stringify(params)}`;
  const cached = queryCache.get(cacheKey);
  
  // 캐시 확인
  if (cached && cached.expiry > Date.now()) {
    if (isVercel) {
      console.log('🎯 Cache hit for query:', query.substring(0, 50));
    }
    return cached.data;
  }
  
  // 캐시 미스 - DB 조회
  const data = await executeQuery<T>(query, params, timeoutMs);
  
  // 캐시 저장
  queryCache.set(cacheKey, {
    data,
    expiry: Date.now() + (cacheSeconds * 1000)
  });
  
  if (isVercel) {
    console.log('💾 Cached query result:', query.substring(0, 50));
  }
  
  return data;
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