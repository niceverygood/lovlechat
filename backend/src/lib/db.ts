import mysql from "mysql2/promise";

// 환경별 설정 최적화
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// 환경변수 기반 DB 설정 (보안 강화)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_DATABASE || 'lovlechat',
  
  // 연결 풀 최적화 (로컬 개발 환경에서 더 많은 연결 허용)
  waitForConnections: true,
  connectionLimit: isVercel ? 3 : (isProduction ? 10 : 15), // 로컬: 15, 운영: 10, Vercel: 3
  queueLimit: 0,
  
  // 성능 최적화 설정
  multipleStatements: false,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  
  // 문자셋 설정
  charset: 'utf8mb4',
  
  // 연결 타임아웃 최적화
  connectTimeout: isVercel ? 30000 : (isProduction ? 20000 : 5000), // 로컬: 5초, 운영: 20초, Vercel: 30초
  
  // 연결 유지 설정 (연결 풀 정리 빈도 감소)
  idleTimeout: isVercel ? 300000 : (isProduction ? 300000 : 600000), // 5-10분 유지
  
  // SSL 설정 (RDS에서는 필요시 활성화) - MySQL2 호환성 향상
  ssl: (isProduction || isVercel) ? { 
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  } : undefined,
  
  // MySQL2 호환성 설정
  typeCast: function (field: any, next: any) {
    if (field.type === 'TINY' && field.length === 1) {
      return (field.string() === '1'); // TINYINT(1) -> Boolean
    }
    return next();
  }
});

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