import { pool } from './db';

// 최적화된 쿼리 실행 함수 (연결 테스트 없이 직접 실행)
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 5000
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('QUERY_TIMEOUT'));
    }, timeoutMs);

    pool.query(query, params)
      .then(([rows]) => {
        clearTimeout(timeoutId);
        resolve(rows as T[]);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// 단일 쿼리 실행 (INSERT, UPDATE, DELETE)
export async function executeMutation(
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 8000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('MUTATION_TIMEOUT'));
    }, timeoutMs);

    pool.query(query, params)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// 안전한 JSON 파싱
export function parseJsonSafely(jsonString: any): any {
  if (!jsonString) return null;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString;
  }
} 