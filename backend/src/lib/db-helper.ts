import { pool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 재시도 설정 최적화
const MAX_RETRIES = 2; // 3 → 2
const RETRY_DELAY = 500; // 1초 → 0.5초

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
      // 로그 출력 최소화
      if (process.env.NODE_ENV === 'development') {
        console.log(`재시도... 남은 횟수: ${retries}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 1.2); // 지수 백오프 축소 (1.5 → 1.2)
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
    'ER_LOCK_DEADLOCK'
  ]; // 불필요한 에러 코드 제거
  
  // 로그 출력 최소화
  if (process.env.NODE_ENV === 'development') {
    console.error('DB 에러:', {
      code: error.code,
      message: error.message
    });
  }
  
  return retryableCodes.includes(error.code) || 
         error.message?.includes('TIMEOUT') ||
         error.message?.includes('Connection lost');
}

// 최적화된 쿼리 실행 함수 (SELECT용)
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 3000 // 5초 → 3초
): Promise<T[]> {
  return withRetry(async () => {
    return new Promise<T[]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`QUERY_TIMEOUT: ${timeoutMs}ms exceeded`);
        if (process.env.NODE_ENV === 'development') {
          console.error('Query timeout:', { query, timeoutMs });
        }
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

      // 로그 출력 최소화
      if (process.env.NODE_ENV === 'development') {
        console.log('Executing query:', { query, params: cleanParams });
      }

      pool.query(query, cleanParams)
        .then(([rows, fields]: [QueryResult, FieldPacket[]]) => {
          clearTimeout(timeoutId);
          if (process.env.NODE_ENV === 'development') {
            console.log('Query result count:', Array.isArray(rows) ? rows.length : 0);
          }
          resolve(rows as T[]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`Query failed: ${query}`, { error: error.message });
          reject(error);
        });
    });
  });
}

// 최적화된 변경 작업 함수 (INSERT, UPDATE, DELETE용)
export async function executeMutation(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 5000 // 8초 → 5초
): Promise<[ResultSetHeader, FieldPacket[]]> {
  return withRetry(async () => {
    return new Promise<[ResultSetHeader, FieldPacket[]]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`MUTATION_TIMEOUT: ${timeoutMs}ms exceeded`));
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
          resolve(result as [ResultSetHeader, FieldPacket[]]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`Mutation failed: ${query}`, { error: error.message });
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
    return result;
  } catch (error: any) {
    await connection.rollback();
    if (process.env.NODE_ENV === 'development') {
      console.error('Transaction failed:', error);
    }
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
  timeoutMs: number = 8000 // 10초 → 8초
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
    if (process.env.NODE_ENV === 'development') {
      console.warn('JSON parsing failed:', { input: jsonString, error: error.message });
    }
    return jsonString; // 파싱 실패시 원본 반환
  }
}

// DB 연결 상태 확인 최적화
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await executeQuery("SELECT 1 as connected", [], 2000); // 3초 → 2초
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// 쿼리 성능 모니터링 최적화 (개발 환경 전용)
export async function executeQueryWithMetrics<T = any>(
  query: string,
  params: any[] = [],
  timeoutMs: number = 3000 // 5초 → 3초
): Promise<{ data: T[], duration: number, query: string }> {
  const startTime = Date.now();
  
  try {
    const data = await executeQuery<T>(query, params, timeoutMs);
    const duration = Date.now() - startTime;
    
    // 느린 쿼리 감지 조건 완화 (1초 → 2초)
    if (process.env.NODE_ENV === 'development' && duration > 2000) {
      console.warn(`⚠️ 느린 쿼리 감지 (${duration}ms):`, query);
    }
    
    return { data, duration, query };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Query failed after ${duration}ms:`, { query, error });
    throw error;
  }
}

// 캐시를 위한 간단한 메모리 저장소 (소규모 데이터용)
const queryCache = new Map<string, { data: any, expiry: number }>();

// 캐시된 쿼리 실행 (읽기 전용 데이터용)
export async function executeQueryWithCache<T = any>(
  query: string,
  params: any[] = [],
  cacheSeconds: number = 300, // 5분 캐시
  timeoutMs: number = 3000
): Promise<T[]> {
  const cacheKey = `${query}_${JSON.stringify(params)}`;
  const cached = queryCache.get(cacheKey);
  
  // 캐시 확인
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  
  // 캐시 미스 - DB 조회
  const data = await executeQuery<T>(query, params, timeoutMs);
  
  // 캐시 저장
  queryCache.set(cacheKey, {
    data,
    expiry: Date.now() + (cacheSeconds * 1000)
  });
  
  return data;
}

// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (value.expiry < now) {
      queryCache.delete(key);
    }
  }
}, 60000); // 1분마다 정리 