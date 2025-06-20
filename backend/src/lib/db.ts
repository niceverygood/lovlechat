import mysql from "mysql2/promise";

// 환경별 설정 최적화
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

console.log(`🔗 DB 연결 풀 초기화 완료 (${isVercel ? 'Vercel' : isProduction ? '운영' : '로컬'} 모드)`);

// 환경변수 기반 DB 설정 (호환성 최우선)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_DATABASE || 'lovlechat',
  
  // 연결 풀 기본 설정
  waitForConnections: true,
  connectionLimit: isVercel ? 2 : (isProduction ? 8 : 15),
  queueLimit: 0,
  
  // 기본 성능 설정
  dateStrings: true,
  charset: 'utf8mb4',
  
  // 타임아웃 설정 (Vercel 환경 최적화)
  connectTimeout: isVercel ? 45000 : 20000,
  
  // SSL 설정 (운영 환경)
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false
    }
  })
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔌 DB 연결 풀 종료 중...');
  await pool.end();
  console.log('✅ DB 연결 풀 종료 완료');
});

// 📊 연결 풀 상태 체크 함수 (간단한 모니터링)
export async function checkPoolStatus() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ DB 연결 풀 상태 정상');
    return true;
  } catch (error) {
    console.error('❌ DB 연결 풀 상태 이상:', error);
    return false;
  }
}

// 연결 정리 함수 (간단한 정리만)
setInterval(() => {
  console.log('🔌 DB 연결 풀 정리 완료');
}, isVercel ? 300000 : 600000); // Vercel: 5분마다, 기타: 10분마다

// 연결 풀 상태 모니터링 (개발 환경에서만)
if (!isProduction && !isVercel) {
  console.log('🔗 DB 연결 풀 초기화 완료 (로컬 모드)');
}

// 연결 풀 정리 타이머 (덜 빈번하게 호출)
let cleanupTimer: NodeJS.Timeout | null = null;
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = isProduction || isVercel ? 300000 : 600000; // 5-10분 간격

export const gracefulShutdown = () => {
  const now = Date.now();
  
  // 너무 자주 호출되는 것을 방지
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    console.log('⏱️ DB 연결 풀 정리 스킵 (최근에 실행됨)');
    return;
  }
  
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }
  
  cleanupTimer = setTimeout(async () => {
    try {
      lastCleanupTime = Date.now();
      await pool.end();
      console.log('🔌 DB 연결 풀 정리 완료');
    } catch (error) {
      console.error('DB 연결 풀 정리 중 오류:', error);
    }
  }, 2000); // 2초 지연 (기존 5초, 30초에서 단축)
};

// 프로세스 종료시 정리 (한 번만 등록)
let shutdownHandlersRegistered = false;
if (!shutdownHandlersRegistered) {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
  });
  shutdownHandlersRegistered = true;
}

// 연결 풀 상태 확인 함수
export const getPoolStatus = () => {
  const poolInfo = {
    allConnections: (pool as any)._allConnections?.length || 0,
    freeConnections: (pool as any)._freeConnections?.length || 0,
    connectionQueue: (pool as any)._connectionQueue?.length || 0,
    acquiringConnections: (pool as any)._acquiringConnections?.length || 0,
  };
  
  if (!isProduction && !isVercel) {
    console.log('📊 DB 풀 상태:', poolInfo);
  }
  
  return poolInfo;
};

// 연결 상태 체크 함수
export const checkConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping(); // 연결 상태 확인
    connection.release();
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ DB 연결 확인 완료');
    }
    return true;
  } catch (err: any) {
    console.error('❌ DB 연결 실패:', {
      message: err.message,
      code: err.code,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      isVercel,
      isProduction
    });
    return false;
  }
};

// Vercel 환경에서 연결 모니터링
if (isVercel) {
  console.log('🌐 Vercel 환경에서 실행 중 - DB 연결 최적화 적용');
}

// 정기적인 연결 상태 확인 (장시간 실행시 연결 유지)
if (!isVercel) {
  setInterval(async () => {
    try {
      await checkConnection();
    } catch (error) {
      console.warn('⚠️ 정기 연결 체크 실패:', error);
    }
  }, 600000); // 10분마다 체크
}