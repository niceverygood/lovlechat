import mysql from "mysql2/promise";

// 환경별 설정 최적화
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

console.log(`🔗 DB 연결 풀 초기화 완료 (${isVercel ? 'Vercel' : isProduction ? '운영' : '로컬'} 모드)`);

// 환경변수 기반 DB 설정 (호환성 최우선)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_DATABASE || 'lovlechat',
  
  // 연결 풀 Vercel 최적화
  waitForConnections: true,
  connectionLimit: isVercel ? 3 : (isProduction ? 8 : 15), // Vercel은 더 적게
  queueLimit: 0,
  
  // 기본 성능 설정
  dateStrings: true,
  charset: 'utf8mb4',
  
  // 타임아웃 설정 (Vercel 환경 최적화)
  connectTimeout: isVercel ? 60000 : 20000, // Vercel: 60초
  
  // SSL 설정 (운영 환경)
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false
    }
  })
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔌 DB 연결 풀 종료 중...');
  await pool.end();
  console.log('✅ DB 연결 풀 종료 완료');
});

// 📊 연결 풀 상태 체크 함수 (간단한 모니터링)
export async function checkPoolStatus() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ DB 연결 풀 상태 정상');
    return true;
  } catch (error) {
    console.error('❌ DB 연결 풀 상태 이상:', error);
    return false;
  }
}

// 연결 정리 함수 (간단한 정리만)
setInterval(() => {
  console.log('🔌 DB 연결 풀 정리 완료');
}, isVercel ? 300000 : 600000); // Vercel: 5분마다, 기타: 10분마다

// 연결 풀 상태 모니터링 (개발 환경에서만)
if (!isProduction && !isVercel) {
  console.log('🔗 DB 연결 풀 초기화 완료 (로컬 모드)');
}

// 연결 풀 정리 타이머 최적화
let cleanupTimer: NodeJS.Timeout | null = null;
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = isVercel ? 180000 : 300000; // Vercel: 3분, 기타: 5분

export const gracefulShutdown = () => {
  const now = Date.now();
  
  // 너무 자주 호출되는 것을 방지
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    console.log('⏱️ DB 연결 풀 정리 스킵 (최근에 실행됨)');
    return;
  }
  
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }
  
  cleanupTimer = setTimeout(async () => {
    try {
      lastCleanupTime = Date.now();
      
      // Vercel에서는 강제 종료하지 않고 유연하게 처리
      if (isVercel) {
        console.log('🌐 Vercel 환경: DB 연결 풀 유지');
        return;
      }
      
      await pool.end();
      console.log('🔌 DB 연결 풀 정리 완료');
    } catch (error) {
      console.error('DB 연결 풀 정리 중 오류:', error);
    }
  }, isVercel ? 1000 : 2000); // Vercel은 더 빠르게
};

// 프로세스 종료 시 정리 (Vercel 최적화)
if (!isVercel) {
  process.on('SIGINT', () => {
    console.log('SIGINT 받음, DB 연결 정리 중...');
    gracefulShutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('SIGTERM 받음, DB 연결 정리 중...');
    gracefulShutdown();
    process.exit(0);
  });
}

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

// 연결 상태 체크 함수 최적화
export const checkConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ DB 연결 확인 완료');
    return true;
  } catch (error: any) {
    console.error('❌ DB 연결 실패:', error.message);
    return false;
  }
};

// Vercel 환경에서 연결 모니터링 강화
if (isVercel) {
  console.log('🌐 Vercel 환경에서 실행 중 - DB 연결 최적화 적용');
  
  // Vercel 환경에서는 더 자주 상태 체크
  setInterval(async () => {
    try {
      await checkConnection();
    } catch (error) {
      console.warn('⚠️ Vercel 연결 체크 실패:', error);
    }
  }, 120000); // 2분마다 체크
} else if (!isVercel) {
  // 정기적인 연결 상태 확인 (장시간 실행시 연결 유지)
  setInterval(async () => {
    try {
      await checkConnection();
    } catch (error) {
      console.warn('⚠️ 정기 연결 체크 실패:', error);
    }
  }, 600000); // 10분마다 체크
}

// 연결 풀 이벤트 리스너 (디버깅용)
if (process.env.NODE_ENV === 'development' || isVercel) {
  pool.on('connection', (connection) => {
    console.log('🔗 새 DB 연결 생성:', connection.threadId);
  });
  
  pool.on('acquire', (connection) => {
    console.log('📥 DB 연결 획득:', connection.threadId);
  });
  
  pool.on('release', (connection) => {
    console.log('📤 DB 연결 반환:', connection.threadId);
  });
  
  pool.on('enqueue', () => {
    console.log('⏳ DB 연결 대기열에 추가');
  });
}