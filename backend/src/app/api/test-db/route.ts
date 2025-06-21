import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { CORS_HEADERS } from '../../../lib/cors';

// 🔍 DB 연결 상태 테스트 API
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DB 연결 테스트 시작...');
    
    const pool = getPool();
    // 1. 기본 연결 테스트
    const connection = await pool.getConnection();
    console.log('✅ DB 연결 풀 획득 성공');
    
    // 2. 간단한 쿼리 테스트
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ 테스트 쿼리 실행 성공');
    
    // 3. 테이블 존재 확인
    const [tables] = await connection.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
      AND table_name IN ('users', 'personas', 'character_profiles', 'chats', 'character_favors', 'heart_transactions')
    `, [process.env.DB_DATABASE || 'lovlechat']);
    
    connection.release();
    console.log('✅ DB 연결 테스트 완료');
    
    const tableList = (tables as any[]).map(t => t.table_name || t.TABLE_NAME);
    const missingTables = ['users', 'personas', 'character_profiles', 'chats', 'character_favors', 'heart_transactions']
      .filter(table => !tableList.includes(table));
    
    return NextResponse.json({
      ok: true,
      message: '🎉 DB 연결 성공!',
      database: process.env.DB_DATABASE || 'lovlechat',
      host: process.env.DB_HOST || 'localhost',
      existingTables: tableList,
      missingTables: missingTables,
      status: missingTables.length === 0 ? 'READY' : 'SETUP_REQUIRED',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }, {
      status: 200,
      headers: CORS_HEADERS
    });
    
  } catch (error: any) {
    console.error('❌ DB 연결 테스트 실패:', error);
    
    return NextResponse.json({
      ok: false,
      message: '💥 DB 연결 실패',
      error: error.message,
      code: error.code,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_DATABASE || 'lovlechat',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      troubleshooting: {
        '1. 환경변수 확인': 'DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE',
        '2. 네트워크 확인': 'DB 서버에 외부 접속 허용되어 있는지 확인',
        '3. 방화벽 확인': '3306 포트가 열려있는지 확인',
        '4. 계정 권한 확인': 'DB 사용자가 해당 데이터베이스에 접근 권한이 있는지 확인'
      }
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
} 