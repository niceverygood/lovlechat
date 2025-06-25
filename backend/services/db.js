const mysql = require('mysql2/promise');

// DB 설정
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'lovlechat',
  charset: 'utf8mb4',
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // MySQL2 호환 성능 최적화 설정
  multipleStatements: false
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

// 쿼리 실행 (SELECT) - 성능 분석 강화
async function executeQuery(query, params = [], enableExplain = false) {
  let connection = null;
  const startTime = Date.now();
  
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    
    console.log('🔍 SQL 실행:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    
    // EXPLAIN 실행 (개발 환경에서만)
    if (enableExplain && process.env.NODE_ENV === 'development' && query.trim().toUpperCase().startsWith('SELECT')) {
      try {
        const [explainRows] = await connection.execute(`EXPLAIN ${query}`, params);
        console.log('📊 쿼리 실행 계획:');
        explainRows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.select_type} | ${row.table} | ${row.type} | ${row.key || 'No Index'} | rows: ${row.rows}`);
        });
      } catch (explainError) {
        console.warn('⚠️ EXPLAIN 실행 실패:', explainError.message);
      }
    }
    
    const [rows] = await connection.execute(query, params);
    const duration = Date.now() - startTime;
    
    console.log(`⚡ 쿼리 실행 완료: ${duration}ms (${rows.length}행)`);
    
    // 느린 쿼리 경고 (100ms 이상)
    if (duration > 100) {
      console.warn(`🐌 느린 쿼리 감지: ${duration}ms - 최적화 필요`);
    }
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ 쿼리 실행 에러:', error.message);
    console.error('🔍 실행된 쿼리:', query);
    console.error('📊 파라미터:', params);
    console.error(`⏱️ 실행 시간: ${duration}ms`);
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

// 최적화된 쿼리 실행 (SELECT 필드 명시 + EXPLAIN)
async function executeOptimizedQuery(query, params = []) {
  return executeQuery(query, params, true);
}

// JOIN 기반 통합 쿼리 실행
async function executeJoinQuery(query, params = []) {
  const startTime = Date.now();
  console.log('🔗 JOIN 쿼리 실행:', query.substring(0, 150) + (query.length > 150 ? '...' : ''));
  
  const result = await executeOptimizedQuery(query, params);
  const duration = Date.now() - startTime;
  
  console.log(`🚀 JOIN 쿼리 완료: ${duration}ms`);
  return result;
}

module.exports = {
  getPool,
  checkConnection,
  executeQuery,
  executeOptimizedQuery,
  executeJoinQuery,
  executeMutation,
  executeQueryWithCache,
  executeTransaction,
  parseJsonSafely,
  clearCache
}; 