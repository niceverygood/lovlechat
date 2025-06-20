import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// === 환경 설정 ===
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' && !isVercel;

// === 극도로 최적화된 설정 ===
const QUERY_TIMEOUT = 6000; // 타임아웃 더 단축
const MAX_RETRIES = 0; // 재시도 완전 제거
const CACHE_TTL = 30000; // 30초로 대폭 단축
const MAX_CACHE_SIZE = isVercel ? 10 : 20; // 캐시 크기 제한

// === 메모리 최적화 캐시 시스템 ===
interface CacheEntry {
  data: any;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const activeQueries = new Map<string, Promise<any>>(); // 중복 쿼리 완전 차단

// === 캐시 키 생성 (해시 기반으로 최적화) ===
function createCacheKey(query: string, params?: any[]): string {
  const queryHash = query.replace(/\s+/g, ' ').trim().substring(0, 50);
  const paramsHash = params ? params.map(p => String(p)).join('|') : '';
  return `${queryHash}:${paramsHash}`;
}

// === 캐시 조회 (TTL 체크) ===
function getCachedResult(cacheKey: string): any | null {
  const entry = queryCache.get(cacheKey);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

// === 캐시 저장 (LRU 기반 크기 관리) ===
function setCachedResult(cacheKey: string, data: any): void {
  // 캐시 크기 관리
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    queryCache.delete(oldestKey);
  }
  
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// === 극한 최적화된 쿼리 실행 함수 ===
export async function executeQuery(
  query: string, 
  params: any[] = [],
  options: { cache?: boolean; noLog?: boolean } = {}
): Promise<any[]> {
  
  // 1. 캐시 우선 확인
  const cacheKey = createCacheKey(query, params);
  
  if (options.cache !== false) {
    const cached = getCachedResult(cacheKey);
    if (cached !== null) {
      return cached; // 캐시 히트 시 즉시 반환
    }
  }
  
  // 2. 중복 쿼리 완전 차단
  if (activeQueries.has(cacheKey)) {
    return activeQueries.get(cacheKey)!;
  }
  
  // 3. 쿼리 실행 (타임아웃 적용)
  const queryPromise = (async () => {
    const pool = getPool();
    
    // Promise.race로 타임아웃 적용
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT);
    });
    
    const queryPromise = pool.execute(query, params);
    
    try {
      const [rows] = await Promise.race([queryPromise, timeoutPromise]) as [RowDataPacket[], FieldPacket[]];
      
      // 개발 환경에서만 최소한의 로깅
      if (isDevelopment && !options.noLog) {
        console.log(`🔍 Executing query: {`);
        
        // 쿼리 잘림 방지를 위한 완전한 로깅
        const fullQuery = query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`  query: '${fullQuery.length > 150 ? fullQuery.substring(0, 150) + '...' : fullQuery}',`);
        
        console.log(`  params: [${params.slice(0, 5).map(p => 
          typeof p === 'string' ? `'${p.length > 20 ? p.substring(0, 20) + '...' : p}'` : p
        ).join(', ')}${params.length > 5 ? ', ...' : ''}]`);
        console.log(`}`);
        console.log(`✅ Query result count: ${Array.isArray(rows) ? rows.length : 'N/A'}`);
      }
      
      return Array.isArray(rows) ? rows : [];
      
    } catch (error: any) {
      // 타임아웃이나 연결 에러 시 캐시된 데이터 사용
      if (options.cache !== false) {
        const staleEntry = queryCache.get(cacheKey);
        if (staleEntry) {
          return staleEntry.data;
        }
      }
      
      throw error;
    }
  })();
  
  // 4. 활성 쿼리에 등록
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 5. SELECT 쿼리만 캐시
    if (options.cache !== false && query.trim().toUpperCase().startsWith('SELECT')) {
      setCachedResult(cacheKey, result);
    }
    
    return result;
    
  } catch (error: any) {
    if (isDevelopment) {
      console.error('❌ Query failed:', {
        query: query.substring(0, 80) + '...',
        error: error.message
      });
    }
    throw error;
    
  } finally {
    // 6. 활성 쿼리에서 제거
    activeQueries.delete(cacheKey);
  }
}

// === 최적화된 트랜잭션 함수 ===
export async function executeTransaction(operations: Array<{
  query: string;
  params?: any[];
}>): Promise<any[]> {
  
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results: any[] = [];
    
    for (const op of operations) {
      const [rows] = await connection.execute(op.query, op.params || []);
      results.push(Array.isArray(rows) ? rows : []);
    }
    
    await connection.commit();
    return results;
    
  } catch (error: any) {
    await connection.rollback();
    throw error;
    
  } finally {
    connection.release();
  }
}

// === 캐시 관리 ===
export function clearCache(): void {
  queryCache.clear();
  activeQueries.clear();
}

export function getCacheStats() {
  return {
    size: queryCache.size,
    activeQueries: activeQueries.size,
    hitRate: queryCache.size > 0 ? (queryCache.size / (queryCache.size + activeQueries.size)) : 0
  };
}

// === 자동 캐시 정리 (5분마다) ===
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of queryCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL * 2) { // TTL의 2배가 지나면 제거
      queryCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && isDevelopment) {
    console.log(`🧹 Auto cache cleanup: ${cleaned} items removed`);
  }
}, 5 * 60 * 1000); 