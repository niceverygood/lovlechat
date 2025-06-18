import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_NAME || 'lovlechat-db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});