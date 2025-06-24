const mysql = require('mysql2/promise');

// DB 설정
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'lovlechat',
  charset: 'utf8mb4',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

let pool = null;

// DB 풀 초기화
function getPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(DB_CONFIG);
      console.log('🔗 MySQL DB 연결 풀 초기화 완료');
      console.log(`📍 연결 정보: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
      
      // 연결 풀 이벤트 리스너
      pool.on('connection', (connection) => {
        console.log('새로운 DB 연결 생성:', connection.threadId);
      });
      
      pool.on('error', (err) => {
        console.error('DB 풀 에러:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('DB 연결이 끊어짐, 재연결 시도...');
        }
      });
    } catch (error) {
      console.error('DB 풀 초기화 실패:', error);
      throw error;
    }
  }
  return pool;
}

// DB 연결 확인
async function checkConnection() {
  try {
    const connection = await getPool().getConnection();
    await connection.execute('SELECT 1 as test');
    connection.release();
    console.log('✅ DB 연결 상태 정상');
    return true;
  } catch (error) {
    console.error('❌ DB 연결 에러:', error.message);
    return false;
  }
}

// 쿼리 실행 (SELECT) - 에러 처리 강화
async function executeQuery(query, params = []) {
  let connection = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    
    console.log('🔍 SQL 실행:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    
    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ 쿼리 실행 에러:', error.message);
    console.error('🔍 실행된 쿼리:', query);
    console.error('📊 파라미터:', params);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 쿼리 실행 (INSERT, UPDATE, DELETE) - 에러 처리 강화
async function executeMutation(query, params = []) {
  let connection = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    
    console.log('📝 SQL 실행:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    
    const [result] = await connection.execute(query, params);
    
    console.log('✅ 변경된 행 수:', result.affectedRows);
    if (result.insertId) {
      console.log('🆔 생성된 ID:', result.insertId);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 뮤테이션 실행 에러:', error.message);
    console.error('🔍 실행된 쿼리:', query);
    console.error('📊 파라미터:', params);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 캐시된 쿼리 실행
const queryCache = new Map();
async function executeQueryWithCache(query, params = [], cacheKey = null, ttl = 60000) {
  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log('📦 캐시에서 반환:', cacheKey);
      return cached.data;
    }
  }

  const result = await executeQuery(query, params);

  if (cacheKey && ttl > 0) {
    queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    console.log('💾 캐시에 저장:', cacheKey);
  }

  return result;
}

// 트랜잭션 실행
async function executeTransaction(queries) {
  let connection = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    
    await connection.beginTransaction();
    console.log('🔄 트랜잭션 시작');
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    console.log('✅ 트랜잭션 커밋 완료');
    
    return results;
  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.log('🔄 트랜잭션 롤백');
    }
    console.error('❌ 트랜잭션 에러:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// JSON 파싱 헬퍼
function parseJsonSafely(jsonString, defaultValue = null) {
  if (!jsonString) return defaultValue;
  if (typeof jsonString === 'object') return jsonString; // 이미 객체인 경우
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('⚠️ JSON 파싱 실패:', jsonString);
    return defaultValue;
  }
}

// 캐시 정리
function clearCache() {
  queryCache.clear();
  console.log('🧹 쿼리 캐시 정리 완료');
}

// 정기적 캐시 정리 (10분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > 600000) { // 10분 초과
      queryCache.delete(key);
    }
  }
  console.log('🧹 오래된 캐시 자동 정리, 현재 캐시 수:', queryCache.size);
}, 600000);

// 프로세스 종료 시 연결 정리
process.on('SIGINT', async () => {
  console.log('📴 프로세스 종료 신호 수신, DB 연결 정리 중...');
  if (pool) {
    await pool.end();
    console.log('✅ MySQL DB 연결 풀 정리 완료');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('📴 프로세스 종료 신호 수신, DB 연결 정리 중...');
  if (pool) {
    await pool.end();
    console.log('✅ MySQL DB 연결 풀 정리 완료');
  }
  process.exit(0);
});

module.exports = {
  getPool,
  checkConnection,
  executeQuery,
  executeMutation,
  executeQueryWithCache,
  executeTransaction,
  parseJsonSafely,
  clearCache
}; 