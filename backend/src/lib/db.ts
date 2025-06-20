import mysql from "mysql2/promise";

// 환경 감지 (더 정확하게)
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// 싱글톤 패턴으로 DB 풀 관리
class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: mysql.Pool | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getPool(): mysql.Pool {
    if (!this.pool || !this.isInitialized) {
      this.initializePool();
    }
    return this.pool!;
  }

  private initializePool() {
    if (this.isInitialized && this.pool) {
      return this.pool;
    }

    console.log(`🔗 DB 풀 초기화 (${isVercel ? 'Vercel' : isProduction ? '운영' : '로컬'})`);

    // Vercel 환경에 특별히 최적화된 설정
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1234',
      database: process.env.DB_DATABASE || 'lovlechat',
      
      // Vercel 환경 최적화
      connectionLimit: isVercel ? 1 : (isProduction ? 5 : 10), // Vercel은 최소화
      queueLimit: 0,
      waitForConnections: true,
      
      // 타임아웃 설정 (Vercel은 매우 짧게)
      acquireTimeout: isVercel ? 30000 : 60000,
      timeout: isVercel ? 30000 : 60000,
      
      // 연결 재사용 최적화
      reconnect: true,
      idleTimeout: isVercel ? 300000 : 600000, // 5분/10분
      maxIdle: isVercel ? 1 : 2,
      
      // 기본 설정
      dateStrings: true,
      charset: 'utf8mb4',
      
      // SSL (운영 환경만)
      ...(isProduction && {
        ssl: { rejectUnauthorized: false }
      })
    };

    this.pool = mysql.createPool(poolConfig);
    this.isInitialized = true;

    // 이벤트 리스너 설정 (한 번만)
    if (!isVercel) { // Vercel에서는 이벤트 리스너 최소화
      this.pool.on('connection', (connection) => {
        console.log('🔗 새 DB 연결:', connection.threadId);
      });
    }

    // Vercel에서는 graceful shutdown 최소화
    if (!isVercel) {
      process.on('SIGTERM', this.cleanup.bind(this));
      process.on('SIGINT', this.cleanup.bind(this));
    }

    console.log('✅ DB 풀 초기화 완료');
    return this.pool;
  }

  private async cleanup() {
    if (this.pool) {
      console.log('🔌 DB 풀 정리 중...');
      await this.pool.end();
      console.log('✅ DB 풀 정리 완료');
    }
  }

  // 연결 상태 체크
  public async checkConnection(): Promise<boolean> {
    try {
      const connection = await this.getPool().getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      console.error('❌ DB 연결 체크 실패:', error);
      return false;
    }
  }
}

// 전역 인스턴스 export
const dbManager = DatabaseManager.getInstance();
export const pool = dbManager.getPool();

// 유틸리티 함수들
export const checkConnection = () => dbManager.checkConnection();

// Vercel에서의 웜업 함수
export const warmupConnection = async () => {
  if (isVercel) {
    try {
      await checkConnection();
      console.log('🔥 Vercel 연결 웜업 완료');
    } catch (error) {
      console.warn('⚠️ Vercel 웜업 실패:', error);
    }
  }
};