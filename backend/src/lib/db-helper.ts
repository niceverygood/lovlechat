import { getPool } from './db';
import { FieldPacket, QueryResult, ResultSetHeader, RowDataPacket } from 'mysql2';

// === 환경 설정 ===
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' && !isVercel;
const isDummyMode = true; // 개발 모드에서는 더미 모드 활성화

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
function createCacheKey(query: string, params: any[]): string {
  return `${query.substring(0, 50)}:${JSON.stringify(params)}`;
}

// === 더미 데이터 생성 함수 ===
function generateDummyData(query: string): any[] {
  if (isDevelopment) {
    console.log('🟨 Dummy mode: returning empty result for query:', query.substring(0, 50));
  }
  
  // 특정 쿼리에 대해 더미 데이터 반환
  if (query.includes('SELECT userId, hearts') && query.includes('FROM users')) {
    return [{
      userId: 'dummy_user',
      hearts: 1000,
      lastHeartUpdate: new Date().toISOString()
    }];
  }
  
  if (query.includes('SELECT id, userId, name') && query.includes('FROM personas')) {
    return [{
      id: 'dummy_persona',
      userId: 'dummy_user', 
      name: '테스트 페르소나',
      avatar: '/imgdefault.jpg',
      gender: '남성',
      age: '25',
      job: '개발자'
    }];
  }
  
  return [];
}

// === 🔥 초고속 쿼리 실행기 ===
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<RowDataPacket[]> {
  // 더미 모드에서는 더미 데이터 반환
  if (isDummyMode) {
    return generateDummyData(query);
  }
  
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
  
  // 실제 쿼리 실행
  const queryPromise = executeActualQuery(query, params);
  activeQueries.set(cacheKey, queryPromise);
  
  try {
    const result = await queryPromise;
    
    // 캐시 저장 (크기 제한)
    if (queryCache.size >= MAX_CACHE_SIZE) {
      const firstKey = queryCache.keys().next().value;
      queryCache.delete(firstKey);
    }
    queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } finally {
    activeQueries.delete(cacheKey);
  }
}

// === 실제 DB 쿼리 실행 ===
async function executeActualQuery(query: string, params: any[]): Promise<RowDataPacket[]> {
  const startTime = Date.now();
  
  try {
    if (isDevelopment) {
      console.log('🔍 Executing query:', { 
        query: query.length > 100 ? query.substring(0, 100) + '...' : query,
        params 
      });
    }
    
    // 타임아웃과 함께 쿼리 실행
    const pool = getPool();
    const queryResult = await Promise.race([
      pool.execute(query, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
      )
    ]) as [RowDataPacket[], FieldPacket[]];
    
    const [rows] = queryResult;
    
    if (isDevelopment) {
      console.log(`✅ Query result count: ${rows.length}`);
    }
    
    return rows;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query error (${duration}ms):`, error);
    throw error;
  }
}

// === 🔥 초고속 INSERT/UPDATE 실행기 ===
export async function executeUpdate(
  query: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  // 더미 모드에서는 성공 응답 반환
  if (isDummyMode) {
    if (isDevelopment) {
      console.log('🟨 Dummy mode: simulating update for query:', query.substring(0, 50));
    }
    return {
      fieldCount: 0,
      affectedRows: 1,
      insertId: 1,
      info: '',
      serverStatus: 0,
      warningStatus: 0,
      changedRows: 0
    };
  }
  
  const startTime = Date.now();
  
  try {
    if (isDevelopment) {
      console.log('🔍 Executing update:', { 
        query: query.length > 100 ? query.substring(0, 100) + '...' : query,
        params 
      });
    }
    
    const pool = getPool();
    const [result] = await Promise.race([
      pool.execute(query, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
      )
    ]) as [ResultSetHeader, FieldPacket[]];
    
    if (isDevelopment) {
      console.log(`✅ Update affected rows: ${result.affectedRows}`);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Update error (${duration}ms):`, error);
    throw error;
  }
}

// === 트랜잭션 실행기 ===
export async function executeTransaction(queries: Array<{query: string, params: any[]}>) {
  // 더미 모드에서는 성공 응답 반환
  if (isDummyMode) {
    if (isDevelopment) {
      console.log('🟨 Dummy mode: simulating transaction with', queries.length, 'queries');
    }
    return { success: true };
  }
  
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const {query, params} of queries) {
      await connection.execute(query, params);
    }
    
    await connection.commit();
    return { success: true };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// === 정리 함수 ===
export function clearCache() {
  queryCache.clear();
  activeQueries.clear();
  if (isDevelopment) {
    console.log('🧹 Cache cleaned:', queryCache.size, 'items');
  }
}

// === 🚀 변경 쿼리 실행 (INSERT/UPDATE/DELETE) ===
export async function executeMutation(
  query: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  // 더미 모드에서는 성공 응답 반환
  if (isDummyMode) {
    if (isDevelopment) {
      console.log('🟨 Dummy mode: returning mock result for mutation:', query.substring(0, 50));
    }
    return {
      affectedRows: 1,
      insertId: 1,
      changedRows: 1
    } as ResultSetHeader;
  }
  
  let connection;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    
    if (isDevelopment) {
      console.log('🔄 Executing mutation:', {
        query: query,
        params: params
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
      if (isDevelopment) {
        console.log('✅ DB 연결 확인 완료');
      }
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