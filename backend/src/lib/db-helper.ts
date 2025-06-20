import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// === 환경 설정 ===
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' && !isVercel;

// === 🚀 극한 최적화 설정 ===
const QUERY_TIMEOUT = 2000; // 2초로 대폭 단축
const CACHE_TTL = 5000; // 5초 초고속 캐싱
const MAX_CACHE_SIZE = 5; // 캐시 크기 최소화

// === 메모리 최적화 캐시 시스템 ===
interface CacheEntry {
  data: any;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const activeQueries = new Map<string, Promise<any>>();

// === 캐시 키 생성 (최적화) ===
function createCacheKey(query: string, params?: any[]): string {
  const queryHash = query.replace(/\\s+/g, ' ').trim().substring(0, 20);
  const paramsString = params && params.length > 0 
    ? params.map(p => p != null ? String(p) : '').join('|')
    : '';
  const paramsHash = paramsString.substring(0, 10);
  return `${queryHash}:${paramsHash}`;
}

// === 🚀 핵심 쿼리 실행 함수 (완전 재설계) ===
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<RowDataPacket[]> {
  const cacheKey = createCacheKey(query, params);
  
  // 캐시 확인
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // 중복 요청 차단
  if (activeQueries.has(cacheKey)) {
    return activeQueries.get(cacheKey)!;
  }
  
  const queryPromise = (async () => {
    let connection;
    try {
      const pool = await getPool();
      connection = await pool.getConnection();
      
      // 🔍 개발 환경에서만 최소한의 로깅
      if (isDevelopment) {
        console.log('🔍 Executing query:', {
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          params: params.slice(0, 3)
        });
      }
      
      const [rows] = await connection.execute(query, params);
      const result = Array.isArray(rows) ? rows as RowDataPacket[] : [];
      
      if (isDevelopment) {
        console.log(`✅ Query result count: ${result.length}`);
      }
      
      // 결과 캐싱
      queryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      // 캐시 크기 제한
      if (queryCache.size > MAX_CACHE_SIZE) {
        const oldestKey = queryCache.keys().next().value;
        queryCache.delete(oldestKey);
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Query error:', error.message);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  })();
  
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    return result;
  } finally {
    activeQueries.delete(cacheKey);
  }
}

// === 🚀 변경 쿼리 실행 (INSERT/UPDATE/DELETE) ===
export async function executeMutation(
  query: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  let connection;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    
    if (isDevelopment) {
      console.log('🔄 Executing mutation:', {
        query: query.substring(0, 50) + '...',
        params: params.slice(0, 2)
      });
    }
    
    const [result] = await connection.execute(query, params);
    
    // 관련 캐시 무효화
    queryCache.clear();
    
    return result as ResultSetHeader;
    
  } catch (error: any) {
    console.error('❌ Mutation error:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// === 🚀 캐시된 쿼리 실행 ===
export async function executeQueryWithCache(
  query: string,
  params: any[] = [],
  ttl: number = CACHE_TTL
): Promise<RowDataPacket[]> {
  return executeQuery(query, params);
}

// === JSON 파싱 유틸리티 ===
export function parseJsonSafely(jsonString: string, defaultValue: any = null): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

// === 캐시 정리 (1분마다) ===
if (typeof process !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    queryCache.forEach((value, key) => {
      if (now - value.timestamp > CACHE_TTL * 2) {
        queryCache.delete(key);
        cleaned++;
      }
    });
    
    if (cleaned > 0 && isDevelopment) {
      console.log(`🧹 Cache cleaned: ${cleaned} items`);
    }
  }, 60000);
} 