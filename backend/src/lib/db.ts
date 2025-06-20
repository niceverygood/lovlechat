import mysql from "mysql2/promise";
import { EventEmitter } from 'events';

// EventEmitter 메모리 누수 방지
EventEmitter.defaultMaxListeners = 20;
process.setMaxListeners(20);

// Vercel 환경 감지 최적화
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
const isLocal = process.env.NODE_ENV === 'development' && !isVercel;

// 연결 설정 최적화 (기본 설정만 사용)
const connectionConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'admin', 
  password: process.env.DB_PASSWORD || 'Lovle123!',
  database: process.env.DB_DATABASE || 'lovlechat',
  charset: 'utf8mb4',
  
  // 기본 풀 설정
  connectionLimit: isVercel ? 1 : (isLocal ? 5 : 3),
  
  // 대기열 설정
  waitForConnections: true,
  queueLimit: 0,
  
  // SSL 설정 (보안)
  ssl: isLocal ? undefined : {
    rejectUnauthorized: false
  }
};

// 완전 최적화된 싱글톤 DB 매니저
class OptimizedDatabaseManager {
  private static instance: OptimizedDatabaseManager;
  private pool: mysql.Pool | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30초

  private constructor() {
    // 프로세스 종료시 정리
    process.once('SIGINT', () => this.cleanup());
    process.once('SIGTERM', () => this.cleanup());
    process.once('beforeExit', () => this.cleanup());
    
    // Vercel 환경에서 즉시 초기화
    if (isVercel) {
      this.initialize().catch(console.error);
    }
  }

  static getInstance(): OptimizedDatabaseManager {
    if (!OptimizedDatabaseManager.instance) {
      OptimizedDatabaseManager.instance = new OptimizedDatabaseManager();
    }
    return OptimizedDatabaseManager.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.pool) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.createPool();
    return this.initializationPromise;
  }

  private async createPool(): Promise<void> {
    try {
      // 기존 풀 정리
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }

      console.log(`🔗 DB 연결 풀 초기화 완료 (${isVercel ? 'Vercel' : isLocal ? '로컬' : '프로덕션'} 모드)`);
      
      this.pool = mysql.createPool(connectionConfig);
      
      // 연결 테스트
      await this.testConnection();
      
      this.isInitialized = true;
      console.log(`✅ DB 연결 확인 완료`);
      
    } catch (error: any) {
      console.error('❌ DB 풀 초기화 실패:', error.message);
      this.pool = null;
      this.isInitialized = false;
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('DB 풀이 초기화되지 않았습니다');
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.query('SELECT 1 as test');
      connection.release();
      this.lastHealthCheck = Date.now();
    } catch (error: any) {
      throw new Error(`DB 연결 테스트 실패: ${error.message}`);
    }
  }

  private async reconnect(): Promise<void> {
    console.log('🔄 DB 연결 재시도...');
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // 잠시 대기 후 재연결
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.initialize();
  }

  // 자동 헬스 체크
  private async healthCheck(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return true; // 최근에 체크했으면 패스
    }

    try {
      await this.testConnection();
      return true;
    } catch (error) {
      console.warn('⚠️ DB 헬스 체크 실패, 재연결 시도');
      await this.reconnect();
      return false;
    }
  }

  async getPool(): Promise<mysql.Pool> {
    // 헬스 체크 (비차단)
    this.healthCheck().catch(() => {});
    
    if (!this.isInitialized || !this.pool) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('DB 연결 풀 생성 실패');
    }

    return this.pool;
  }

  async cleanup(): Promise<void> {
    console.log('🔌 DB 연결 풀 정리 완료');
    
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error: any) {
        // 정리 오류 무시
      } finally {
        this.pool = null;
        this.isInitialized = false;
      }
    }
  }

  // 연결 상태 정보
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasPool: !!this.pool,
      lastHealthCheck: this.lastHealthCheck,
      environment: isVercel ? 'vercel' : isLocal ? 'local' : 'production'
    };
  }
}

// 싱글톤 인스턴스 export
const dbManager = OptimizedDatabaseManager.getInstance();

// 최적화된 풀 접근 함수들
export async function getPool(): Promise<mysql.Pool> {
  return dbManager.getPool();
}

// 메인 풀 export (호환성 유지)
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

export async function warmupConnection(): Promise<boolean> {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    console.log('🔥 DB 연결 웜업 완료');
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
  console.log('🔄 강제 DB 재연결...');
  await dbManager.cleanup();
  await dbManager.getPool();
}

// Vercel 환경에서 즉시 웜업
if (isVercel) {
  warmupConnection().catch(() => 
    console.warn('⚠️ 초기 웜업 실패, 첫 요청시 재시도됩니다.')
  );
}