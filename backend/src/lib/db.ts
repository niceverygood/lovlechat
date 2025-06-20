import mysql from "mysql2/promise";

// === 완전한 메모리 누수 방지 시스템 ===
require('events').EventEmitter.defaultMaxListeners = 0;

// 모든 이벤트 리스너 제한 해제
try {
  if (process.setMaxListeners) process.setMaxListeners(0);
  if (process.stdout && process.stdout.setMaxListeners) process.stdout.setMaxListeners(0);
  if (process.stderr && process.stderr.setMaxListeners) process.stderr.setMaxListeners(0);
} catch (error) {
  // 이벤트 리스너 설정 실패 무시
}

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

// === 극한 최적화 DB 설정 ===
const DB_CONFIG: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 단일 연결로 최적화
  connectionLimit: 1,
  waitForConnections: false, // 대기 시간 제거
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

// === 진정한 싱글톤 DB 풀 ===
export function getPool(): mysql.Pool {
  // 이미 생성된 경우 즉시 반환
  if (global.__LOVLE_DB_POOL__ && global.__LOVLE_DB_READY__) {
    return global.__LOVLE_DB_POOL__;
  }

  // 처음 생성시에만
  if (!global.__LOVLE_DB_POOL__) {
    global.__LOVLE_DB_POOL__ = mysql.createPool(DB_CONFIG);
    global.__LOVLE_DB_READY__ = true;
    
    // 개발 환경에서만 한 번만 로그
    if (isLocal && !global.__LOVLE_CLEANUP_DONE__) {
      console.log('🚀 DB 초기화 완료 (고성능 모드)');
    }
  }

  // 정리 핸들러는 딱 한 번만 등록
  if (!global.__LOVLE_CLEANUP_DONE__) {
    // 모든 정리 로직을 하나로 통합
    const cleanup = async () => {
      if (global.__LOVLE_DB_POOL__) {
        try {
          await global.__LOVLE_DB_POOL__.end();
          global.__LOVLE_DB_POOL__ = undefined;
          global.__LOVLE_DB_READY__ = false;
        } catch (error) {
          // 에러 무시 (이미 정리됨)
        }
      }
    };

    // 단일 핸들러로 모든 종료 신호 처리
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT', 'beforeExit'];
    signals.forEach(signal => {
      process.once(signal as any, cleanup);
    });

    // uncaughtException 처리
    process.once('uncaughtException', async (error) => {
      await cleanup();
      process.exit(1);
    });

    global.__LOVLE_CLEANUP_DONE__ = true;
  }

  return global.__LOVLE_DB_POOL__;
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
    
  } catch (error) {
    isHealthy = false;
    lastCheck = now;
    
    // 에러 로그는 프로덕션에서만
    if (isProduction) {
      console.error('DB 연결 에러:', error);
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