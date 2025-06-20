const mysql = require('mysql2/promise');

const LOCAL_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '1234',
  database: 'lovlechat'
};

async function checkLocalDB() {
  let connection = null;
  
  try {
    console.log('🔌 로컬 DB 연결 중...');
    connection = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ 로컬 DB 연결 성공!');
    
    // 테이블 목록 확인
    console.log('\n📋 로컬 DB의 테이블들:');
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('❌ 테이블이 하나도 없습니다!');
      return;
    }

    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${Object.values(table)[0]}`);
    });
    
    // 각 테이블의 레코드 수 확인
    console.log('\n📊 각 테이블의 데이터 수:');
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = rows[0].count;
        console.log(`  - ${tableName}: ${count}개 레코드`);
      } catch (error) {
        console.log(`  - ${tableName}: 오류 (${error.message})`);
      }
    }
    
    // 각 테이블의 구조 확인 (CREATE TABLE 문 생성)
    console.log('\n🏗️  테이블 구조:');
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      try {
        const [createTable] = await connection.query(`SHOW CREATE TABLE ${tableName}`);
        console.log(`\n-- ${tableName} 테이블`);
        console.log(createTable[0]['Create Table']);
      } catch (error) {
        console.log(`❌ ${tableName} 구조 조회 실패: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 로컬 DB 연결 종료');
    }
  }
}

checkLocalDB(); 