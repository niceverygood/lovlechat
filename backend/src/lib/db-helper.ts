import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// === 환경 설정 ===
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' && !isVercel;

// === 극한 최적화 설정 ===
const QUERY_TIMEOUT = 3000; // 3초로 단축
const CACHE_TTL = 10000; // 10초로 대폭 단축 (실시간성 우선)
const MAX_CACHE_SIZE = isVercel ? 5 : 10; // 캐시 크기 최소화

// === 메모리 최적화 캐시 시스템 ===
interface CacheEntry {
  data: any;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const activeQueries = new Map<string, Promise<any>>();

// === 캐시 키 생성 (해시 최적화) ===
function createCacheKey(query: string, params?: any[]): string {
  const queryHash = query.replace(/\s+/g, ' ').trim().substring(0, 30);
  let paramsString = '';
  
  if (params && params.length > 0) {
    paramsString = params.map(p => p != null ? String(p) : '').join('|');
  }
  
  const paramsHash = paramsString.substring(0, 20);
  return `${queryHash}:${paramsHash}`;
}

// === 캐시 조회 ===
function getCachedResult(cacheKey: string): any | null {
  const entry = queryCache.get(cacheKey);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

// === 캐시 저장 (LRU) ===
function setCachedResult(cacheKey: string, data: any): void {
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    queryCache.delete(oldestKey);
  }
  
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// === 개선된 로깅 시스템 (쿼리 잘림 방지) ===
function logQuery(query: string, params: any[], resultCount: number, duration: number): void {
  if (!isDevelopment) return; // 개발 환경에서만 로깅
  
  // 쿼리 완전 보존 (잘림 방지)
  const cleanQuery = query.replace(/\s+/g, ' ').trim();
  
  // 긴 쿼리는 여러 줄로 출력
  if (cleanQuery.length > 100) {
    console.log('🔍 Long Query Execution:');
    console.log(`  📝 Query: ${cleanQuery.substring(0, 100)}...`);
    console.log(`  📝 Full: ${cleanQuery}`);
  } else {
    console.log(`🔍 Query: ${cleanQuery}`);
  }
  
  // 파라미터 요약
  if (params.length > 0) {
    const paramSummary = params.slice(0, 3).map(p => 
      typeof p === 'string' ? `'${p.length > 10 ? p.substring(0, 10) + '...' : p}'` : p
    ).join(', ');
    console.log(`  📋 Params: [${paramSummary}${params.length > 3 ? ', ...' : ''}]`);
  }
  
  console.log(`  ✅ Result: ${resultCount} rows (${duration}ms)`);
}

// === 메인 쿼리 실행 함수 ===
export async function executeQuery(
  query: string, 
  params: any[] = [],
  options: { cache?: boolean; timeout?: number } = {}
): Promise<any[]> {
  
  const startTime = Date.now();
  const cacheKey = createCacheKey(query, params);
  
  // 1. 캐시 확인
  if (options.cache !== false) {
    const cached = getCachedResult(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }
  
  // 2. 중복 요청 방지
  if (activeQueries.has(cacheKey)) {
    return activeQueries.get(cacheKey)!;
  }
  
  // 3. 쿼리 실행
  const queryPromise = (async () => {
    const pool = getPool();
    
    // 타임아웃 처리
    const timeout = options.timeout || QUERY_TIMEOUT;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });
    
    try {
      const [rows] = await Promise.race([
        pool.execute(query, params),
        timeoutPromise
      ]) as [RowDataPacket[], FieldPacket[]];
      
      const result = Array.isArray(rows) ? rows : [];
      const duration = Date.now() - startTime;
      
      // 개선된 로깅
      logQuery(query, params, result.length, duration);
      
      return result;
      
    } catch (error: any) {
      // 타임아웃이나 에러 시 캐시된 데이터 사용
      if (options.cache !== false) {
        const staleEntry = queryCache.get(cacheKey);
        if (staleEntry) {
          return staleEntry.data;
        }
      }
      
      throw error;
    }
  })();
  
  // 4. 활성 쿼리 등록
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 5. SELECT 쿼리 캐싱
    if (options.cache !== false && query.trim().toUpperCase().startsWith('SELECT')) {
      setCachedResult(cacheKey, result);
    }
    
    return result;
    
  } catch (error: any) {
    if (isDevelopment) {
      console.error(`❌ Query failed: ${query.substring(0, 50)}... - ${error.message}`);
    }
    throw error;
    
  } finally {
    activeQueries.delete(cacheKey);
  }
}

// === 캐시 쿼리 함수 ===
export async function executeQueryWithCache(
  query: string,
  params: any[] = [],
  cacheDuration: number = CACHE_TTL
): Promise<any[]> {
  
  const cacheKey = createCacheKey(query, params);
  
  // 커스텀 TTL 확인
  const entry = queryCache.get(cacheKey);
  if (entry && (Date.now() - entry.timestamp) < cacheDuration) {
    return entry.data;
  }
  
  // 중복 방지
  if (activeQueries.has(cacheKey)) {
    return activeQueries.get(cacheKey)!;
  }
  
  const queryPromise = executeQuery(query, params, { cache: false });
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 커스텀 TTL로 저장
    queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } finally {
    activeQueries.delete(cacheKey);
  }
}

// === 뮤테이션 함수 ===
export async function executeMutation(
  query: string,
  params: any[] = []
): Promise<any> {
  
  const pool = getPool();
  const startTime = Date.now();
  
  try {
    const [result] = await pool.execute(query, params) as [ResultSetHeader, FieldPacket[]];
    
    // 관련 캐시 무효화
    const affectedKeys = Array.from(queryCache.keys()).filter(key => {
      if (query.includes('INSERT INTO chats') || query.includes('UPDATE chats')) {
        return key.includes('chats');
      }
      if (query.includes('INSERT INTO personas') || query.includes('UPDATE personas')) {
        return key.includes('personas');
      }
      return false;
    });
    
    affectedKeys.forEach(key => queryCache.delete(key));
    
    const duration = Date.now() - startTime;
    
    if (isDevelopment) {
      console.log(`🔄 Mutation: ${query.substring(0, 50)}... (${duration}ms)`);
      console.log(`🗑️ Invalidated ${affectedKeys.length} cache entries`);
    }
    
    return result;
    
  } catch (error: any) {
    if (isDevelopment) {
      console.error(`❌ Mutation failed: ${error.message}`);
    }
    throw error;
  }
}

// === JSON 파싱 ===
export function parseJsonSafely(jsonString: string, fallback: any = []): any {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return fallback;
  }
}

// === 트랜잭션 ===
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
    hitRate: queryCache.size > 0 ? Math.round((queryCache.size / (queryCache.size + activeQueries.size)) * 100) : 0
  };
}

// === 자동 캐시 정리 (2분마다) ===
if (isDevelopment) {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of queryCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL * 2) {
        queryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: ${cleaned} items removed`);
    }
  }, 2 * 60 * 1000);
} 