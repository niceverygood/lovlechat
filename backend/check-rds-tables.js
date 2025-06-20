const mysql = require('mysql2/promise');

const RDS_CONFIG = {
  host: 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'Lovle123!',
  database: 'lovlechat'
};

async function checkRDSTables() {
  let connection = null;
  
  try {
    console.log('🔌 RDS 연결 중...');
    connection = await mysql.createConnection(RDS_CONFIG);
    console.log('✅ RDS 연결 성공!');
    
    // 테이블 목록 확인
    console.log('\n📋 현재 데이터베이스의 테이블들:');
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('❌ 테이블이 하나도 없습니다!');
    } else {
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${Object.values(table)[0]}`);
      });
    }
    
    // 각 테이블의 구조 확인
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\n🔍 ${tableName} 테이블 구조:`);
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 RDS 연결 종료');
    }
  }
}

checkRDSTables(); 