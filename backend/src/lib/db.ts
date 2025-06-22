import mysql from "mysql2/promise";
import { EventEmitter } from 'events';

// === 완전한 메모리 누수 방지 시스템 ===
EventEmitter.defaultMaxListeners = 0;

// === 전역 변수로 진정한 싱글톤 보장 ===
declare global {
  var __LOVLE_DB_POOL__: mysql.Pool | undefined;
  var __LOVLE_DB_READY__: boolean | undefined;
  var __LOVLE_CLEANUP_DONE__: boolean | undefined;
}

// === 환경 설정 ===
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const isLocal = !isVercel && process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isDummyMode = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' && process.env.DB_USER === 'dummy';

// === 🚀 극도로 최적화된 DB 설정 ===
const DB_CONFIG: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 단일 연결로 최적화
  connectionLimit: 1,
  waitForConnections: false,
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

// === 🚀 전역 싱글톤 DB 풀 ===
function initializePool(): mysql.Pool {
  if (global.__LOVLE_DB_POOL__) {
    return global.__LOVLE_DB_POOL__;
  }
  
  const pool = mysql.createPool(DB_CONFIG);
  global.__LOVLE_DB_POOL__ = pool;
  
  // 한 번만 로그 출력
  if (!global.__LOVLE_DB_READY__) {
    console.log(`🔗 DB 연결 풀 초기화 완료 (${isLocal ? '로컬' : 'Vercel'} 모드)`);
    global.__LOVLE_DB_READY__ = true;
  }
  
  // 프로세스 종료 시 정리 (한 번만 등록)
  if (!global.__LOVLE_CLEANUP_DONE__) {
    const cleanup = async () => {
      try {
        if (global.__LOVLE_DB_POOL__) {
          await global.__LOVLE_DB_POOL__.end();
          global.__LOVLE_DB_POOL__ = undefined;
        }
      } catch (err: unknown) {
        console.warn('DB 풀 정리 중 에러 발생 (무시됨):', (err as Error).message);
      }
    };
    
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);
    process.once('exit', cleanup);
    
    global.__LOVLE_CLEANUP_DONE__ = true;
  }
  
  return pool;
}

// === 🚀 메인 풀 접근 함수 ===
export function getPool(): mysql.Pool {
  if (isDummyMode) {
    throw new Error('더미 모드에서는 DB 연결을 사용할 수 없습니다');
  }
  return initializePool();
}

// === 캐시된 연결 확인 ===
let lastCheck = 0;
let isHealthy = true;
const CHECK_INTERVAL = 60000; // 1분

export async function checkConnection(): Promise<boolean> {
  const now = Date.now();
  
  // 캐시된 결과 사용 (1분간)
  if (now - lastCheck < CHECK_INTERVAL && isHealthy) {
    return isHealthy;
  }

  try {
    const pool = getPool();
    await pool.execute('SELECT 1');
    
    isHealthy = true;
    lastCheck = now;
    return true;
    
  } catch (error: any) {
    isHealthy = false;
    lastCheck = now;
    
    // 에러 로그는 프로덕션에서만
    if (isProduction) {
      console.error('DB 연결 에러:', error as Error);
    }
    
    return false;
  }
}

// === 풀 정보 (로깅 없음) ===
export function getPoolStats() {
  return {
    ready: !!global.__LOVLE_DB_READY__,
    environment: isVercel ? 'vercel' : isLocal ? 'local' : 'production',
    connectionLimit: DB_CONFIG.connectionLimit
  };
}

// Vercel에서는 즉시 웜업
if (isVercel) {
  checkConnection().catch(() => {});
}