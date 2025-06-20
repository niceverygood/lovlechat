import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';

// 최적화된 타임아웃 설정
const QUERY_TIMEOUT = isVercel ? 12000 : 8000;
const MAX_RETRIES = isVercel ? 1 : 2;

// 강화된 캐싱 시스템
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5분마다 정리
const MAX_CACHE_SIZE = isVercel ? 20 : 40;

// 진행 중인 쿼리 추적 (중복 방지)
const pendingQueries = new Map<string, Promise<any>>();

// 최적화된 재시도 로직
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === retries) throw error;
      
      // 재시도 가능한 에러인지 확인
      const shouldRetry = error.code === 'ECONNRESET' || 
                         error.code === 'ETIMEDOUT' || 
                         error.message?.includes('connection');
      
      if (!shouldRetry) throw error;
      
      // 지수 백오프
      const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('재시도 실패');
}

// 캐시 정리 (백그라운드)
let cacheCleanupTimer: NodeJS.Timeout | null = null;

function startCacheCleanup() {
  if (cacheCleanupTimer) return;
  
  cacheCleanupTimer = setInterval(() => {
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
    
    if (!isProduction && cleaned > 0) {
      console.log(`🧹 캐시 정리: ${cleaned}개 항목 제거`);
    }
  }, CACHE_CLEANUP_INTERVAL);
}

// 캐시 정리 시작
startCacheCleanup();

// 안전한 쿼리 로깅 (문자열 잘림 방지)
function logQuery(query: string, params?: any[]) {
  if (isProduction) return; // 프로덕션에서는 로깅 최소화
  
  try {
    // 쿼리를 완전한 형태로 로깅 (잘림 방지)
    const fullQuery = query.length > 500 ? 
      query.substring(0, 500) + '...(truncated)' : 
      query;
    
    console.log('🔍 Executing query:', {
      query: fullQuery.replace(/\s+/g, ' ').trim(),
      params: params?.slice(0, 10) || [] // 파라미터도 제한
    });
  } catch (error) {
    // 로깅 에러는 무시
  }
}

// 결과 로깅 (간소화)
function logResult(result: any) {
  if (isProduction) return;
  
  try {
    const count = Array.isArray(result) ? result.length : 
                  result?.affectedRows !== undefined ? result.affectedRows :
                  'unknown';
    console.log(`✅ Query result count: ${count}`);
  } catch (error) {
    // 로깅 에러는 무시
  }
}

export async function executeQuery<T extends RowDataPacket[]>(
  query: string,
  params?: any[],
  ttl: number = 300000 // 5분 기본 TTL
): Promise<T> {
  const cacheKey = `${query}:${JSON.stringify(params)}`;
  
  // 중복 요청 확인
  if (pendingQueries.has(cacheKey)) {
    return pendingQueries.get(cacheKey);
  }
  
  // 캐시 확인
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  
  // 새로운 쿼리 실행
  const queryPromise = withRetry(async () => {
    const pool = await getPool();
    
    logQuery(query, params);
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT);
    });
    
    const queryPromise = pool.execute(query, params || []);
    const [rows] = await Promise.race([queryPromise, timeoutPromise]) as [T, FieldPacket[]];
    
    logResult(rows);
    
    // 캐시 저장
    queryCache.set(cacheKey, {
      data: rows,
      timestamp: Date.now(),
      ttl
    });
    
    return rows;
  });
  
  // 진행 중인 쿼리로 등록
  pendingQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    return result;
  } catch (error: any) {
    // 에러 발생 시 stale cache 사용 시도
    if (cached) {
      if (!isProduction) {
        console.warn('⚠️ 쿼리 에러, 캐시된 데이터 사용:', error.message);
      }
      return cached.data;
    }
    throw error;
  } finally {
    // 완료된 쿼리는 제거
    pendingQueries.delete(cacheKey);
  }
}

export async function executeUpdate(
  query: string,
  params?: any[]
): Promise<ResultSetHeader> {
  return withRetry(async () => {
    const pool = await getPool();
    
    logQuery(query, params);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Update timeout')), QUERY_TIMEOUT);
    });
    
    const queryPromise = pool.execute(query, params || []);
    const [result] = await Promise.race([queryPromise, timeoutPromise]) as [ResultSetHeader, FieldPacket[]];
    
    logResult(result);
    
    // 관련 캐시 무효화
    for (const [key] of queryCache.entries()) {
      if (key.includes(query.split(' ')[2]?.toLowerCase() || '')) {
        queryCache.delete(key);
      }
    }
    
    return result;
  });
}

export async function executeTransaction<T>(
  operations: ((connection: any) => Promise<T>)
): Promise<T> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await operations(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 캐시 관리 함수들
export function clearQueryCache(): void {
  queryCache.clear();
  if (!isProduction) {
    console.log('🧹 쿼리 캐시 전체 삭제');
  }
}

export function getCacheStats() {
  return {
    size: queryCache.size,
    maxSize: MAX_CACHE_SIZE,
    pendingQueries: pendingQueries.size
  };
}

// 프로세스 종료 시 정리
process.on('exit', () => {
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer);
  }
});

export default executeQuery; 