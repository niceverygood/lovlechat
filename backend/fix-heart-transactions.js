const mysql = require('mysql2/promise');
const fs = require('fs');

const RDS_CONFIG = {
  host: 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'Lovle123!',
  database: 'lovlechat'
};

async function fixHeartTransactions() {
  let connection = null;
  
  try {
    console.log('🔌 RDS 연결 중...');
    connection = await mysql.createConnection(RDS_CONFIG);
    console.log('✅ RDS 연결 성공!');
    
    // 1. heart_transactions 테이블 생성
    console.log('🏗️  heart_transactions 테이블 생성 중...');
    const createTableSQL = `
      CREATE TABLE \`heart_transactions\` (
        \`id\` int NOT NULL AUTO_INCREMENT COMMENT '거래 고유 ID',
        \`userId\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 ID',
        \`amount\` int NOT NULL COMMENT '하트 변동량 (+구매, -사용)',
        \`type\` enum('purchase','chat','daily_bonus','admin','refresh') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        \`description\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '거래 설명',
        \`beforeHearts\` int NOT NULL COMMENT '거래 전 하트 수',
        \`afterHearts\` int NOT NULL COMMENT '거래 후 하트 수',
        \`relatedId\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '관련 ID (채팅의 경우 personaId_characterId)',
        \`createdAt\` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시각',
        PRIMARY KEY (\`id\`),
        KEY \`idx_userId\` (\`userId\`),
        KEY \`idx_type\` (\`type\`),
        KEY \`idx_createdAt\` (\`createdAt\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='하트 사용/구매 내역'
    `;
    
    await connection.query(createTableSQL);
    console.log('✅ heart_transactions 테이블 생성 완료');
    
    // 2. 데이터 삽입
    console.log('💾 heart_transactions 데이터 삽입 중...');
    const dataSQL = fs.readFileSync('./lovlechat_data_only.sql', 'utf8');
    
    // heart_transactions INSERT 문만 추출
    const heartTransactionInserts = dataSQL
      .split('\n')
      .filter(line => line.trim().toLowerCase().includes('insert into `heart_transactions`'))
      .filter(line => line.trim().endsWith(';'));
    
    console.log(`${heartTransactionInserts.length}개의 heart_transactions 레코드 삽입 중...`);
    
    for (const insertSQL of heartTransactionInserts) {
      try {
        await connection.query(insertSQL);
      } catch (error) {
        console.error('INSERT 오류:', error.message);
      }
    }
    
    // 3. 확인
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM heart_transactions');
    console.log(`✅ heart_transactions 테이블에 ${rows[0].count}개 레코드 삽입 완료`);
    
    // 4. 전체 테이블 상태 확인
    console.log('\n📊 최종 마이그레이션 결과:');
    const [tables] = await connection.query('SHOW TABLES');
    
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        const count = rows[0].count;
        console.log(`  - ${tableName}: ${count}개 레코드`);
      } catch (error) {
        console.log(`  - ${tableName}: 조회 실패`);
      }
    }
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 RDS 연결 종료');
    }
  }
}

fixHeartTransactions(); 