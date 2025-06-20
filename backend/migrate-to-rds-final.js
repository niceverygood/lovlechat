const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// RDS 연결 설정
const RDS_CONFIG = {
  host: 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'Lovle123!',
  multipleStatements: true
};

async function migrateToRDS() {
  let connection = null;
  
  try {
    console.log('🔌 RDS 연결 중...');
    connection = await mysql.createConnection(RDS_CONFIG);
    console.log('✅ RDS 연결 성공!');
    
    // 1. lovlechat 데이터베이스 생성
    console.log('🗄️  lovlechat 데이터베이스 생성 중...');
    try {
      await connection.query('CREATE DATABASE IF NOT EXISTS lovlechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      console.log('✅ lovlechat 데이터베이스 생성 완료');
    } catch (error) {
      console.log('⚠️  데이터베이스가 이미 존재하거나 생성 중 오류:', error.message);
    }
    
    // 2. lovlechat 데이터베이스로 연결 재설정
    await connection.end();
    console.log('🔄 lovlechat 데이터베이스로 재연결 중...');
    connection = await mysql.createConnection({
      ...RDS_CONFIG,
      database: 'lovlechat'
    });
    console.log('✅ lovlechat 데이터베이스 연결 완료');
    
    // 3. 스키마 파일 읽기 및 실행
    const schemaPath = path.join(__dirname, 'lovlechat_schema_only.sql');
    console.log('📄 스키마 파일 읽는 중:', schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`스키마 파일을 찾을 수 없습니다: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // SQL 문을 개별적으로 실행 (CREATE TABLE 문만 추출)
    const createTableStatements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && stmt.toLowerCase().includes('create table'));
    
    console.log(`🏗️  ${createTableStatements.length}개의 테이블 생성 중...`);
    
    for (let i = 0; i < createTableStatements.length; i++) {
      const sql = createTableStatements[i] + ';';
      try {
        console.log(`⚡ [${i + 1}/${createTableStatements.length}] 테이블 생성 중...`);
        await connection.query(sql);
        console.log(`✅ [${i + 1}/${createTableStatements.length}] 테이블 생성 완료`);
      } catch (error) {
        console.error(`❌ [${i + 1}/${createTableStatements.length}] 오류:`, error.message);
        console.log('SQL:', sql.substring(0, 100) + '...');
      }
    }
    
    // 4. 테이블 목록 확인
    console.log('\n📋 생성된 테이블 확인:');
    const [tables] = await connection.query('SHOW TABLES');
    if (tables.length === 0) {
      console.log('❌ 생성된 테이블이 없습니다!');
      return;
    }
    
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${Object.values(table)[0]}`);
    });
    
    console.log(`\n🎉 스키마 마이그레이션 완료! ${tables.length}개 테이블 생성됨`);
    
    // 5. 데이터 마이그레이션 진행 여부 확인
    console.log('\n🚀 데이터 마이그레이션을 시작합니다...');
    await migrateData(connection);
    
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 RDS 연결 종료');
    }
  }
}

async function migrateData(connection) {
  try {
    const dataPath = path.join(__dirname, 'lovlechat_data_only.sql');
    console.log('📄 데이터 파일 읽는 중:', dataPath);
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`데이터 파일을 찾을 수 없습니다: ${dataPath}`);
    }
    
    const dataSQL = fs.readFileSync(dataPath, 'utf8');
    
    // INSERT 문만 추출하여 실행
    const insertStatements = dataSQL
      .split('\n')
      .filter(line => line.trim().toLowerCase().startsWith('insert into'))
      .map(line => line.trim())
      .filter(line => line.endsWith(';'));
    
    console.log(`💾 ${insertStatements.length}개의 INSERT 문 실행 중...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < insertStatements.length; i++) {
      const sql = insertStatements[i];
      try {
        if (i % 50 === 0) {
          console.log(`⚡ [${i + 1}/${insertStatements.length}] 데이터 삽입 중... (${Math.round((i/insertStatements.length)*100)}%)`);
        }
        await connection.query(sql);
        successCount++;
      } catch (error) {
        errorCount++;
        if (errorCount < 5) { // 처음 5개 오류만 출력
          console.error(`❌ INSERT 오류 [${i + 1}]:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 데이터 마이그레이션 완료!`);
    console.log(`  ✅ 성공: ${successCount}개`);
    console.log(`  ❌ 실패: ${errorCount}개`);
    
    // 6. 최종 데이터 확인
    console.log('\n📊 마이그레이션된 데이터 확인:');
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
    console.error('❌ 데이터 마이그레이션 오류:', error);
  }
}

// 실행
console.log('🚀 LovleChat 로컬 DB → RDS 마이그레이션 시작\n');
migrateToRDS(); 