import mysql from "mysql2/promise";

// 환경별 DB 설정 최적화
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_NAME || 'lovlechat-db',
  
  // 연결 풀 최적화
  waitForConnections: true,
  connectionLimit: 15, // 연결 수 증가 (10 → 15)
  queueLimit: 0,
  
  // SSL 설정 (프로덕션 환경)
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false
  } : undefined,
  
  // 성능 최적화 설정
  multipleStatements: false,
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
  
  // 문자셋 설정
  charset: 'utf8mb4'
});