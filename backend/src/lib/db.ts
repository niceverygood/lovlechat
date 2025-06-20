import mysql from "mysql2/promise";

// EventEmitter 메모리 누수 완전 방지 - 전역에서 한 번만 설정
if (!process.env.DB_LISTENERS_CONFIGURED) {
  require('events').EventEmitter.defaultMaxListeners = 100;
  process.setMaxListeners(100);
  
  // 기존 리스너 정리 (안전하게)
  const existingListeners = process.listenerCount('uncaughtException');
  if (existingListeners === 0) {
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error.message);
    });
  }
  
  const existingRejectionListeners = process.listenerCount('unhandledRejection');
  if (existingRejectionListeners === 0) {
    process.on('unhandledRejection', (reason) => {
      console.error('🚨 Unhandled Rejection:', reason);
    });
  }
  
  process.env.DB_LISTENERS_CONFIGURED = 'true';
}

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
  connectionLimit: isVercel ? 1 : (isLocal ? 2 : 3),
  
  // 대기열 설정
  waitForConnections: true,
  queueLimit: 0,
  
  // SSL 설정
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
};

// 전역 싱글톤 패턴 (더 엄격한 구현)
class GlobalDatabaseManager {
  private static instance: GlobalDatabaseManager | null = null;
  private static initPromise: Promise<GlobalDatabaseManager> | null = null;
  private pool: mysql.Pool | null = null;
  private isInitialized = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1분
  private cleanupRegistered = false;

  private constructor() {
    // private constructor로 직접 인스턴스 생성 방지
  }

  static async getInstance(): Promise<GlobalDatabaseManager> {
    if (GlobalDatabaseManager.instance) {
      return GlobalDatabaseManager.instance;
    }

    if (GlobalDatabaseManager.initPromise) {
      return GlobalDatabaseManager.initPromise;
    }

    GlobalDatabaseManager.initPromise = GlobalDatabaseManager.createInstance();
    return GlobalDatabaseManager.initPromise;
  }

  private static async createInstance(): Promise<GlobalDatabaseManager> {
    const instance = new GlobalDatabaseManager();
    await instance.initialize();
    GlobalDatabaseManager.instance = instance;
    return instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.pool) {
      return;
    }

    try {
      // 기존 풀 정리
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }

      if (!isProduction) {
        console.log(`🔗 DB 연결 풀 초기화 완료 (${isVercel ? 'Vercel' : isLocal ? '로컬' : '프로덕션'} 모드)`);
      }
      
      this.pool = mysql.createPool(connectionConfig);
      
      // 연결 테스트
      await this.testConnection();
      this.isInitialized = true;
      this.registerCleanup();
      
    } catch (error: any) {
      console.error('❌ DB 초기화 실패:', error.message);
      this.pool = null;
      this.isInitialized = false;
      throw error;
    }
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered) return;
    
    const cleanup = () => {
      this.cleanup().catch(() => {});
    };

    // 안전한 리스너 등록
    if (process.listenerCount('SIGINT') < 5) {
      process.once('SIGINT', cleanup);
    }
    if (process.listenerCount('SIGTERM') < 5) {
      process.once('SIGTERM', cleanup);
    }
    if (process.listenerCount('beforeExit') < 5) {
      process.once('beforeExit', cleanup);
    }
    
    this.cleanupRegistered = true;
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
    await new Promise(resolve => setTimeout(resolve, 200));
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

// 최적화된 풀 접근 함수
export async function getPool(): Promise<mysql.Pool> {
  const manager = await GlobalDatabaseManager.getInstance();
  return manager.getPool();
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
  const manager = await GlobalDatabaseManager.getInstance();
  return manager.getStatus();
}

export async function forceReconnect(): Promise<void> {
  const manager = await GlobalDatabaseManager.getInstance();
  if (!isProduction) {
    console.log('🔄 강제 DB 재연결');
  }
  await manager.cleanup();
  await manager.getPool();
}

// Vercel 환경에서만 즉시 웜업
if (isVercel) {
  warmupConnection().catch(() => {
    if (!isProduction) {
      console.warn('⚠️ 초기 웜업 실패, 첫 요청시 재시도');
    }
  });
}