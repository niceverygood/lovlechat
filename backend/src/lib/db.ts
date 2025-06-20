import mysql from "mysql2/promise";

// 환경변수 기반 DB 설정 (보안 강화)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_DATABASE || 'lovlechat',
  
  // 연결 풀 최적화 (성능 향상)
  waitForConnections: true,
  connectionLimit: 10, // 20 → 10 (메모리 절약)
  queueLimit: 0,
  
  // 성능 최적화 설정
  multipleStatements: false,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  
  // 문자셋 설정
  charset: 'utf8mb4',
  
  // 연결 타임아웃 최적화 (빠른 응답)
  connectTimeout: 10000, // 20초 → 10초
  
  // 연결 에러 핸들링
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // 로그 출력 최소화 (성능 향상)
  debug: false, // 개발환경에서도 false로 설정
  
  // 추가 성능 최적화
  namedPlaceholders: true,
  decimalNumbers: true,
  
  // SSL 설정 (프로덕션 환경용)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : undefined
});

// 연결 상태 체크 함수
export const checkConnection = async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ DB 연결 확인 완료');
    }
    return true;
  } catch (err) {
    console.error('❌ DB 연결 실패:', err);
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

// 초기 연결 테스트 (주석 처리 - 서버 시작 방해 방지)
// (async () => {
//   try {
//     const connection = await pool.getConnection();
//     console.log('Database connection successful');
//     connection.release();
//   } catch (err) {
//     console.error('Failed to connect to database:', err);
//   }
// })();