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
  
  // SSL 설정 (RDS에서는 필요시 활성화)
  ssl: (isProduction || isVercel) ? { rejectUnauthorized: false } : undefined,
});

// 연결 풀 상태 모니터링 (개발 환경에서만)
if (!isProduction && !isVercel) {
  console.log('🔗 DB 연결 풀 초기화 완료 (로컬 모드)');
}

// 정리 함수 최적화 (덜 빈번하게 호출)
let cleanupTimer: NodeJS.Timeout | null = null;

export const gracefulShutdown = () => {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }
  
  cleanupTimer = setTimeout(async () => {
    try {
      await pool.end();
      console.log('🔌 DB 연결 풀 정리 완료');
    } catch (error) {
      console.error('DB 연결 풀 정리 중 오류:', error);
    }
  }, isProduction || isVercel ? 5000 : 30000); // 로컬: 30초, 운영/Vercel: 5초
};

// 프로세스 종료시 정리
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', gracefulShutdown);

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