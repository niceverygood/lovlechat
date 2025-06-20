import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// === 환경 설정 ===
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// === 최적화된 설정 ===
const QUERY_TIMEOUT = isVercel ? 10000 : 8000; // 타임아웃 단축
const MAX_RETRIES = 1; // 재시도 최소화
const CACHE_TTL = isVercel ? 60000 : 120000; // 캐시 TTL (1-2분)
const MAX_CACHE_SIZE = isVercel ? 15 : 25; // 캐시 크기 제한

// === 최적화된 캐시 시스템 ===
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry>();
const activeQueries = new Map<string, Promise<any>>(); // 중복 쿼리 방지

// === 캐시 정리 (주기적) ===
let cacheCleanupTimer: NodeJS.Timeout | null = null;

function startCacheCleanup() {
  if (cacheCleanupTimer) return;
  
  cacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    // 만료된 항목 제거
    for (const [key, entry] of queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        queryCache.delete(key);
        cleaned++;
      }
    }
    
    // LRU 기반 크기 제한
    if (queryCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = queryCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        queryCache.delete(entries[i][0]);
        cleaned++;
      }
    }
    
    if (cleaned > 0 && isDevelopment) {
      console.log(`🧹 캐시 정리 완료: ${cleaned}개 항목 제거`);
    }
  }, 5 * 60 * 1000); // 5분마다
}

// 즉시 정리 시작
startCacheCleanup();

// === 캐시 키 생성 ===
function createCacheKey(query: string, params?: any[]): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${normalizedQuery}:${paramsStr}`;
}

// === 캐시 조회 ===
function getCachedResult(cacheKey: string): any | null {
  const entry = queryCache.get(cacheKey);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

// === 캐시 저장 ===
function setCachedResult(cacheKey: string, data: any, customTtl?: number): void {
  const ttl = customTtl || CACHE_TTL;
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

// === 재시도 로직 ===
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === retries) throw error;
      
      // 연결 관련 에러만 재시도
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      
      throw error; // 즉시 실패
    }
  }
  throw new Error('재시도 한도 초과');
}

// === 메인 쿼리 실행 함수 ===
export async function executeQuery(
  query: string, 
  params: any[] = [],
  options: { cache?: boolean; ttl?: number } = {}
): Promise<any[]> {
  
  // 1. 캐시 확인
  const cacheKey = createCacheKey(query, params);
  
  if (options.cache !== false) {
    const cached = getCachedResult(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }
  
  // 2. 중복 쿼리 방지
  if (activeQueries.has(cacheKey)) {
    return activeQueries.get(cacheKey)!;
  }
  
  // 3. 쿼리 실행
  const queryPromise = withRetry(async () => {
    const pool = getPool();
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('쿼리 타임아웃')), QUERY_TIMEOUT);
    });
    
    const queryPromise = pool.execute(query, params);
    
    const [rows] = await Promise.race([queryPromise, timeoutPromise]) as [RowDataPacket[], FieldPacket[]];
    
    // 개발 환경에서만 제한적 로깅
    if (isDevelopment) {
      console.log(`🔍 Executing query: {`);
      console.log(`  query: '${query.slice(0, 200)}${query.length > 200 ? '...' : ''}',`);
      console.log(`  params: [${params.map(p => typeof p === 'string' ? `'${p}'` : p).join(', ')}]`);
      console.log(`}`);
      console.log(`✅ Query result count: ${Array.isArray(rows) ? rows.length : 'N/A'}`);
    }
    
    return Array.isArray(rows) ? rows : [];
  });
  
  // 4. 활성 쿼리에 등록
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 5. 캐시 저장 (SELECT 쿼리만)
    if (options.cache !== false && query.trim().toUpperCase().startsWith('SELECT')) {
      setCachedResult(cacheKey, result, options.ttl);
    }
    
    return result;
    
  } catch (error: any) {
    // 에러 시 캐시된 데이터 사용 (Stale-While-Revalidate)
    if (options.cache !== false) {
      const staleData = queryCache.get(cacheKey);
      if (staleData) {
        if (isDevelopment) {
          console.warn('⚠️ 에러 발생, 캐시된 데이터 사용:', error.message);
        }
        return staleData.data;
      }
    }
    
    console.error('❌ 쿼리 실행 실패:', {
      query: query.slice(0, 100),
      params: params.slice(0, 3),
      error: error.message
    });
    
    throw error;
    
  } finally {
    // 6. 활성 쿼리에서 제거
    activeQueries.delete(cacheKey);
  }
}

// === 트랜잭션 실행 함수 ===
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
    
    if (isDevelopment) {
      console.log(`✅ 트랜잭션 완료: ${operations.length}개 쿼리 실행`);
    }
    
    return results;
    
  } catch (error: any) {
    await connection.rollback();
    console.error('❌ 트랜잭션 실패:', error.message);
    throw error;
    
  } finally {
    connection.release();
  }
}

// === 캐시 관리 함수들 ===
export function clearCache(): void {
  queryCache.clear();
  activeQueries.clear();
  console.log('🧹 쿼리 캐시 전체 삭제');
}

export function getCacheStats() {
  return {
    size: queryCache.size,
    activeQueries: activeQueries.size,
    maxSize: MAX_CACHE_SIZE
  };
}

// === 프로세스 종료 시 정리 ===
process.on('beforeExit', () => {
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer);
    cacheCleanupTimer = null;
  }
  clearCache();
}); 