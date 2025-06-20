import mysql from "mysql2/promise";

// 환경 감지
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// 싱글톤 패턴으로 DB 풀 관리 (완전 재구성)
class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: mysql.Pool | null = null;
  private isInitialized = false;
  private processListenersAttached = false;

  private constructor() {
    // MaxListeners 제한 해제
    if (typeof process !== 'undefined' && process.setMaxListeners) {
      process.setMaxListeners(0);
    }
  }

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

    const mode = isVercel ? '클라우드' : (isProduction ? '운영' : '로컬');
    console.log(`🔗 DB 연결 풀 초기화 완료 (${mode} 모드)`);

    // Vercel 환경에 특별히 최적화된 설정
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root', 
      password: process.env.DB_PASSWORD || '1234',
      database: process.env.DB_DATABASE || 'lovlechat',
      
      // Vercel 환경 대폭 최적화
      connectionLimit: isVercel ? 1 : (isProduction ? 2 : 5), // 최소화
      queueLimit: 0,
      waitForConnections: true,
      
      // 타임아웃 대폭 단축
      acquireTimeout: isVercel ? 15000 : 30000, // 15초/30초
      timeout: isVercel ? 15000 : 30000,
      
      // 연결 재사용 최적화
      reconnect: true,
      idleTimeout: isVercel ? 180000 : 300000, // 3분/5분
      maxIdle: 1,
      
      // 기본 설정
      dateStrings: true,
      charset: 'utf8mb4',
      
      // SSL (운영 환경)
      ...(isProduction && {
        ssl: { rejectUnauthorized: false }
      })
    };

    this.pool = mysql.createPool(poolConfig);
    this.isInitialized = true;

    // 프로세스 리스너를 한 번만 등록
    if (!this.processListenersAttached && !isVercel) {
      process.once('SIGTERM', this.cleanup.bind(this));
      process.once('SIGINT', this.cleanup.bind(this));
      process.once('beforeExit', this.cleanup.bind(this));
      this.processListenersAttached = true;
    }

    return this.pool;
  }

  private async cleanup() {
    if (this.pool) {
      console.log('🔌 DB 연결 풀 정리 완료');
      try {
        await this.pool.end();
      } catch (error) {
        // 정리 오류 무시
      }
      this.pool = null;
      this.isInitialized = false;
    }
  }

  // 연결 상태 체크 (간소화)
  public async checkConnection(): Promise<boolean> {
    try {
      const connection = await this.getPool().getConnection();
      await connection.ping();
      connection.release();
      console.log('✅ DB 연결 확인 완료');
      return true;
    } catch (error) {
      console.error('❌ DB 연결 체크 실패:', error);
      return false;
    }
  }
}

// 전역 인스턴스 (싱글톤)
const dbManager = DatabaseManager.getInstance();
export const pool = dbManager.getPool();

// 유틸리티 함수들
export const checkConnection = () => dbManager.checkConnection();

// Vercel 연결 웜업 (최적화)
export const warmupConnection = async () => {
  if (isVercel) {
    try {
      await checkConnection();
      console.log('🔥 Vercel 연결 웜업 완료');
    } catch (error) {
      console.warn('⚠️ Vercel 웜업 실패 (무시됨)');
    }
  }
};