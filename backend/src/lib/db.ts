import mysql from "mysql2/promise";

// === 완전한 EventEmitter 메모리 누수 해결 ===
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 0; // 완전히 무제한
process.setMaxListeners(0); // 프로세스 리스너도 무제한

// === TypeScript 전역 타입 선언 ===
declare global {
  var __DB_POOL_SINGLETON__: mysql.Pool | undefined;
  var __DB_INITIALIZED__: boolean | undefined;
  var __DB_CLEANUP_REGISTERED__: boolean | undefined;
}

// === 환경 감지 ===
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const isLocal = process.env.NODE_ENV === 'development' && !isVercel;

// === 극도로 최적화된 DB 설정 ===
const DB_CONFIG: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 최소한의 연결로 최적화
  connectionLimit: 1,
  waitForConnections: true,
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

/**
 * 진정한 싱글톤 DB 풀 (완전히 한 번만 초기화)
 */
export function getPool(): mysql.Pool {
  // 이미 초기화된 글로벌 풀이 있으면 바로 반환
  if (global.__DB_POOL_SINGLETON__) {
    return global.__DB_POOL_SINGLETON__;
  }
  
  // 첫 초기화 시에만 로그 (한 번만)
  if (!global.__DB_INITIALIZED__) {
    if (isLocal) {
      console.log('🚀 DB 연결 풀 초기화 완료 (고성능 모드)');
    }
    global.__DB_INITIALIZED__ = true;
  }
  
  // 새 풀 생성 및 글로벌 할당
  global.__DB_POOL_SINGLETON__ = mysql.createPool(DB_CONFIG);
  
  return global.__DB_POOL_SINGLETON__;
}

/**
 * 경량화된 연결 확인
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 안전한 풀 종료
 */
export async function closePool(): Promise<void> {
  if (global.__DB_POOL_SINGLETON__) {
    try {
      await global.__DB_POOL_SINGLETON__.end();
      global.__DB_POOL_SINGLETON__ = undefined;
      global.__DB_INITIALIZED__ = false;
    } catch (error) {
      // 에러 무시
    }
  }
}

// === 한 번만 등록되는 정리 핸들러 ===
if (!global.__DB_CLEANUP_REGISTERED__) {
  const cleanup = () => {
    closePool().catch(() => {});
  };
  
  // 한 번만 등록
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('beforeExit', cleanup);
  
  global.__DB_CLEANUP_REGISTERED__ = true;
}

// Vercel에서는 즉시 웜업
if (isVercel) {
  checkConnection().catch(() => {});
}