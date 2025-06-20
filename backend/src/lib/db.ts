import mysql from "mysql2/promise";

// === TypeScript 전역 타입 선언 ===
declare global {
  var dbEventListenersConfigured: boolean | undefined;
  var dbCleanupRegistered: boolean | undefined;
}

// === 전역 EventEmitter 설정 (한 번만) ===
if (typeof global.dbEventListenersConfigured === 'undefined') {
  // EventEmitter 한도 대폭 증가
  require('events').EventEmitter.defaultMaxListeners = 0; // 무제한
  process.setMaxListeners(0); // 무제한
  
  // 전역 플래그 설정
  global.dbEventListenersConfigured = true;
  
  console.log('🔧 EventEmitter 무제한 설정 완료');
}

// === 환경 감지 ===
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const isLocal = process.env.NODE_ENV === 'development' && !isVercel;
const isProduction = process.env.NODE_ENV === 'production';

// === 최적화된 DB 설정 ===
const DB_CONFIG: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 환경별 최적화된 연결 설정
  connectionLimit: isVercel ? 1 : (isLocal ? 2 : 1),
  waitForConnections: true,
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

// === 글로벌 싱글톤 풀 ===
let globalPool: mysql.Pool | null = null;
let poolInitialized = false;

/**
 * 최적화된 DB 풀 획득 함수
 */
export function getPool(): mysql.Pool {
  // 이미 초기화된 경우 바로 반환
  if (globalPool && poolInitialized) {
    return globalPool;
  }
  
  // 첫 초기화인 경우에만 로그 출력
  if (!poolInitialized) {
    console.log(`🔗 DB 연결 풀 최초 초기화 (${isVercel ? 'Vercel' : isLocal ? '로컬' : '프로덕션'} 모드)`);
    poolInitialized = true;
  }
  
  // 기존 풀이 있으면 종료
  if (globalPool) {
    globalPool.end().catch(() => {});
  }
  
  // 새 풀 생성
  globalPool = mysql.createPool(DB_CONFIG);
  
  return globalPool;
}

/**
 * 연결 상태 확인 (로깅 최소화)
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ DB 연결 실패:', error);
    return false;
  }
}

/**
 * 웜업 함수 (비동기, 에러 무시)
 */
export async function warmupConnection(): Promise<void> {
  try {
    await checkConnection();
  } catch (error) {
    // 웜업 실패는 무시 (첫 요청에서 재시도)
  }
}

/**
 * 안전한 풀 종료
 */
export async function closePool(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.end();
      globalPool = null;
      poolInitialized = false;
    } catch (error) {
      console.error('❌ DB 풀 종료 실패:', error);
    }
  }
}

// === 프로세스 종료 핸들러 (한 번만 등록) ===
if (typeof global.dbCleanupRegistered === 'undefined') {
  const cleanup = () => {
    closePool().catch(() => {});
  };
  
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('beforeExit', cleanup);
  
  global.dbCleanupRegistered = true;
}

// Vercel 환경에서만 즉시 웜업
if (isVercel) {
  warmupConnection().catch(() => {});
}