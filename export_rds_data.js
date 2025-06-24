const mysql = require('mysql2/promise');
const fs = require('fs');

// DB 설정
const DB_CONFIG = {
  host: 'lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'Lovle123!',
  database: 'lovlechat',
  charset: 'utf8mb4'
};

async function exportData() {
  let connection = null;
  
  try {
    console.log('RDS에 연결 중...');
    connection = await mysql.createConnection(DB_CONFIG);
    
    // 테이블 목록 가져오기
    console.log('테이블 목록 조회 중...');
    const [tables] = await connection.execute('SHOW TABLES');
    
    let sqlDump = `-- LovleChat Database Export\n-- Generated on ${new Date().toISOString()}\n\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
    
    for (const tableRow of tables) {
      const tableName = tableRow[`Tables_in_${DB_CONFIG.database}`];
      console.log(`테이블 처리 중: ${tableName}`);
      
      // 테이블 구조 가져오기
      const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
      sqlDump += `-- Table structure for ${tableName}\n`;
      sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlDump += createTable[0]['Create Table'] + ';\n\n';
      
      // 데이터 가져오기
      const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        sqlDump += `-- Data for table ${tableName}\n`;
        
        // 컬럼 목록 가져오기
        const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${tableName}\``);
        const columnNames = columns.map(col => `\`${col.Field}\``).join(', ');
        
        sqlDump += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES\n`;
        
        const values = rows.map(row => {
          const rowValues = Object.values(row).map(value => {
            if (value === null) return 'NULL';
            if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
            }
            if (value instanceof Date) {
              return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            if (typeof value === 'object') {
              return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            }
            return value;
          });
          return `(${rowValues.join(', ')})`;
        });
        
        sqlDump += values.join(',\n') + ';\n\n';
      }
    }
    
    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    
    // 파일로 저장
    const filename = `lovlechat_export_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.sql`;
    fs.writeFileSync(filename, sqlDump);
    
    console.log(`✅ 데이터 export 완료: ${filename}`);
    console.log(`파일 크기: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Export 실패:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

exportData(); 