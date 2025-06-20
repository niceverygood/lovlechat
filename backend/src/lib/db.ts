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
  
  // 연결 풀 최적화 (Vercel 서버리스 환경에 맞게)
  waitForConnections: true,
  connectionLimit: isVercel ? 3 : 10, // Vercel에서는 적은 수의 연결
  queueLimit: 0,
  
  // 성능 최적화 설정
  multipleStatements: false,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  
  // 문자셋 설정
  charset: 'utf8mb4',
  
  // 연결 타임아웃 최적화 (Vercel 환경에서 증가)
  connectTimeout: isVercel ? 30000 : 10000, // Vercel: 30초, 로컬: 10초
  
  // 연결 에러 핸들링
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // 로그 출력 최적화
  debug: false,
  
  // 추가 성능 최적화
  namedPlaceholders: true,
  decimalNumbers: true,
  
  // SSL 설정 (프로덕션 환경용)
  ssl: isProduction ? {
    rejectUnauthorized: false
  } : undefined
});

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

// 연결 풀 정리 함수 (메모리 누수 방지)
export const closePool = async () => {
  try {
    await pool.end();
    console.log('🔌 DB 연결 풀 정리 완료');
  } catch (err) {
    console.error('DB 연결 풀 정리 실패:', err);
  }
};

// 프로세스 종료시 연결 정리
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

// Vercel 환경에서 연결 모니터링
if (isVercel) {
  console.log('🌐 Vercel 환경에서 실행 중 - DB 연결 최적화 적용');
}