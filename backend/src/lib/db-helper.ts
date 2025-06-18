import { pool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 재시도 설정
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초

// 재시도 헬퍼 함수
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      console.log(`DB 작업 재시도... 남은 횟수: ${retries}, 에러: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 1.5); // 지수 백오프
    }
    throw error;
  }
}

// 재시도 가능한 에러 판단
function shouldRetry(error: any): boolean {
  const retryableCodes = [
    'ECONNRESET',
    'ENOTFOUND', 
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_LOCK_DEADLOCK'
  ];
  return retryableCodes.includes(error.code) || 
         error.message?.includes('TIMEOUT') ||
         error.message?.includes('Connection lost');
}

// 최적화된 쿼리 실행 함수 (SELECT용)
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 5000
): Promise<T[]> {
  return withRetry(async () => {
    return new Promise<T[]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`QUERY_TIMEOUT: ${timeoutMs}ms exceeded`));
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
        .then(([rows, fields]: [QueryResult, FieldPacket[]]) => {
          clearTimeout(timeoutId);
          resolve(rows as T[]);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error(`Query failed: ${query}`, { params: cleanParams, error: error.message });
          reject(error);
        });
    });
  });
}

// 최적화된 변경 작업 함수 (INSERT, UPDATE, DELETE용)
export async function executeMutation(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 8000
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
          console.error(`Mutation failed: ${query}`, { params: cleanParams, error: error.message });
          reject(error);
        });
    });
  });
}

// 트랜잭션 실행 함수
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
    console.error('Transaction failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 배치 INSERT 함수 (대량 데이터 처리용)
export async function executeBatchInsert(
  tableName: string,
  columns: string[],
  values: any[][],
  timeoutMs: number = 10000
): Promise<void> {
  if (values.length === 0) return;
  
  const placeholders = columns.map(() => '?').join(', ');
  const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values.map(() => `(${placeholders})`).join(', ')}`;
  const flatParams = values.flat();
  
  await executeMutation(query, flatParams, timeoutMs);
}

// 안전한 JSON 파싱 (향상된 버전)
export function parseJsonSafely(jsonString: any): any {
  if (!jsonString) return null;
  if (typeof jsonString === 'object') return jsonString;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error: any) {
    console.warn('JSON parsing failed:', { input: jsonString, error: error.message });
    return jsonString; // 원본 반환
  }
}

// DB 연결 상태 확인
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await executeQuery("SELECT 1 as connected", [], 3000);
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// 쿼리 성능 모니터링 (개발 환경용)
export async function executeQueryWithMetrics<T = any>(
  query: string,
  params: any[] = [],
  timeoutMs: number = 5000
): Promise<{ data: T[], duration: number, query: string }> {
  const startTime = Date.now();
  
  try {
    const data = await executeQuery<T>(query, params, timeoutMs);
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`Slow query detected (${duration}ms):`, query);
    }
    
    return { data, duration, query };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`Query failed after ${duration}ms:`, { query, params, error });
    throw error;
  }
} 