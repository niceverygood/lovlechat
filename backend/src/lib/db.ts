import mysql from "mysql2/promise";
import { EventEmitter } from 'events';

// EventEmitter 메모리 누수 완전 방지
EventEmitter.defaultMaxListeners = 50;
process.setMaxListeners(50);

// uncaughtException 및 unhandledRejection 핸들러 추가
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// 환경 감지 최적화
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
const isLocal = process.env.NODE_ENV === 'development' && !isVercel;
const isProduction = process.env.NODE_ENV === 'production';

// 연결 설정 최적화
const connectionConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin', 
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 최적화된 풀 설정
  connectionLimit: isVercel ? 1 : (isLocal ? 3 : 2),
  
  // 대기열 설정
  waitForConnections: true,
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

// 완전 최적화된 싱글톤 패턴
class UltraOptimizedDatabaseManager {
  private static instance: UltraOptimizedDatabaseManager | null = null;
  private pool: mysql.Pool | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1분
  private cleanupRegistered = false;

  private constructor() {
    this.registerCleanup();
  }

  static getInstance(): UltraOptimizedDatabaseManager {
    if (!UltraOptimizedDatabaseManager.instance) {
      UltraOptimizedDatabaseManager.instance = new UltraOptimizedDatabaseManager();
    }
    return UltraOptimizedDatabaseManager.instance;
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered) return;
    
    const cleanup = () => {
      this.cleanup().catch(() => {});
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('beforeExit', cleanup);
    
    this.cleanupRegistered = true;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.pool) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.createPool();
    await this.initPromise;
  }

  private async createPool(): Promise<void> {
    try {
      // 기존 풀 정리
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }

      if (!isProduction) {
        console.log(`🔗 DB 연결 풀 초기화 (${isVercel ? 'Vercel' : isLocal ? 'Local' : 'Prod'} 모드)`);
      }
      
      this.pool = mysql.createPool(connectionConfig);
      
      // 연결 테스트
      await this.testConnection();
      this.isInitialized = true;
      
      if (!isProduction) {
        console.log('✅ DB 연결 확인 완료');
      }
      
    } catch (error: any) {
      console.error('❌ DB 초기화 실패:', error.message);
      this.pool = null;
      this.isInitialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('DB 풀이 초기화되지 않았습니다');
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.query('SELECT 1');
      this.lastHealthCheck = Date.now();
    } finally {
      connection.release();
    }
  }

  private async healthCheck(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return true;
    }

    try {
      await this.testConnection();
      return true;
    } catch (error) {
      if (!isProduction) {
        console.warn('⚠️ DB 헬스 체크 실패, 재연결 시도');
      }
      await this.reconnect();
      return false;
    }
  }

  private async reconnect(): Promise<void> {
    this.isInitialized = false;
    this.initPromise = null;
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.initialize();
  }

  async getPool(): Promise<mysql.Pool> {
    // 비차단 헬스 체크
    this.healthCheck().catch(() => {});
    
    if (!this.isInitialized || !this.pool) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('DB 풀 생성 실패');
    }

    return this.pool;
  }

  async cleanup(): Promise<void> {
    if (!isProduction) {
      console.log('🔌 DB 연결 풀 정리 완료');
    }
    
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // 정리 오류 무시
      } finally {
        this.pool = null;
        this.isInitialized = false;
        this.initPromise = null;
      }
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasPool: !!this.pool,
      lastHealthCheck: this.lastHealthCheck,
      environment: isVercel ? 'vercel' : isLocal ? 'local' : 'production'
    };
  }
}

// 글로벌 싱글톤 인스턴스
const dbManager = UltraOptimizedDatabaseManager.getInstance();

// 최적화된 풀 접근 함수
export async function getPool(): Promise<mysql.Pool> {
  return dbManager.getPool();
}

// 호환성 유지를 위한 풀 래퍼
export const pool = {
  execute: async (query: string, params?: any[]) => {
    const actualPool = await getPool();
    return actualPool.execute(query, params);
  },
  getConnection: async () => {
    const actualPool = await getPool();
    return actualPool.getConnection();
  },
  end: async () => {
    const actualPool = await getPool();
    return actualPool.end();
  }
};

// 유틸리티 함수들
export async function warmupConnection(): Promise<boolean> {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    
    if (!isProduction) {
      console.log('🔥 DB 연결 웜업 완료');
    }
    return true;
  } catch (error: any) {
    console.error('❌ DB 웜업 실패:', error.message);
    return false;
  }
}

export async function getConnectionStatus() {
  return dbManager.getStatus();
}

export async function forceReconnect(): Promise<void> {
  if (!isProduction) {
    console.log('🔄 강제 DB 재연결');
  }
  await dbManager.cleanup();
  await dbManager.getPool();
}

// Vercel 환경에서만 즉시 웜업
if (isVercel) {
  warmupConnection().catch(() => {
    if (!isProduction) {
      console.warn('⚠️ 초기 웜업 실패, 첫 요청시 재시도');
    }
  });
}