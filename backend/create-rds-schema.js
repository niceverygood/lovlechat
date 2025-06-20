const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// RDS 연결 설정 (데이터베이스 없이)
const RDS_CONFIG = {
  host: 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'Lovle123!',
  multipleStatements: true // 여러 SQL 문 실행 허용
};

async function createRDSSchema() {
  let connection = null;
  
  try {
    console.log('🔌 RDS 연결 중...');
    connection = await mysql.createConnection(RDS_CONFIG);
    console.log('✅ RDS 연결 성공!');
    
    // 1. 데이터베이스 생성
    console.log('🗄️  lovlechat 데이터베이스 생성 중...');
    try {
      await connection.query('CREATE DATABASE IF NOT EXISTS lovlechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      console.log('✅ lovlechat 데이터베이스 생성 완료');
    } catch (error) {
      console.log('⚠️  데이터베이스가 이미 존재하거나 생성 중 오류:', error.message);
    }
    
    // 2. 데이터베이스 선택 (연결 재설정)
    await connection.end();
    console.log('🔄 lovlechat 데이터베이스로 재연결 중...');
    connection = await mysql.createConnection({
      ...RDS_CONFIG,
      database: 'lovlechat'
    });
    console.log('✅ lovlechat 데이터베이스 연결 완료');
    
    // 스키마 파일 읽기
    const schemaPath = path.join(__dirname, '..', 'complete_rds_schema.sql');
    console.log('📄 스키마 파일 읽는 중:', schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`스키마 파일을 찾을 수 없습니다: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('📝 스키마 SQL 길이:', schemaSQL.length, '문자');
    
    // SQL 문을 세미콜론으로 분리
    const sqlStatements = schemaSQL
      .split(';')
      .map(sql => sql.trim())
      .filter(sql => sql.length > 0 && !sql.startsWith('--'));
    
    console.log('🚀 총', sqlStatements.length, '개의 SQL 문 실행 예정');
    
    // 각 SQL 문을 순차적으로 실행
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      if (sql.length > 0) {
        try {
          console.log(`⚡ [${i + 1}/${sqlStatements.length}] 실행 중...`);
          await connection.query(sql);
          console.log(`✅ [${i + 1}/${sqlStatements.length}] 완료`);
        } catch (error) {
          // 이미 존재하는 테이블/인덱스 오류는 무시
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  [${i + 1}/${sqlStatements.length}] 이미 존재함 (건너뜀)`);
          } else {
            console.log(`❌ [${i + 1}/${sqlStatements.length}] 오류:`, error.message);
          }
        }
      }
    }
    
    console.log('🎉 RDS 스키마 생성 완료!');
    
    // 테이블 목록 확인
    console.log('\n📋 생성된 테이블 확인:');
    const [tables] = await connection.query('SHOW TABLES');
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${Object.values(table)[0]}`);
    });
    
  } catch (error) {
    console.error('❌ RDS 스키마 생성 실패:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 RDS 연결 종료');
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  createRDSSchema()
    .then(() => {
      console.log('\n✅ 모든 작업 완료!');
      console.log('💡 이제 backend/.env.development.cloud 파일을 생성하고');
      console.log('   클라우드 DB로 연결 테스트를 해보세요.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 작업 실패:', error.message);
      process.exit(1);
    });
}

module.exports = { createRDSSchema }; 