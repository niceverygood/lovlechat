import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/persona?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }});

  // 폴백 페르소나 데이터
  const fallbackPersonas = [
    {
      id: 1,
      userId: userId,
      name: userId,
      avatar: '/avatars/user.jpg',
      gender: '',
      age: '',
      job: '',
      info: '',
      habit: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  try {
    // 연결 테스트 (빠른 타임아웃)
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);

    // 기본 프로필 존재 여부 확인 (타임아웃 적용)
    const existResult = await Promise.race([
      pool.query(
        "SELECT * FROM user_personas WHERE userId = ? AND name = ?",
        [userId, userId]
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
    ]);
    
    const [existRows] = existResult as any;
    
    if (!Array.isArray(existRows) || existRows.length === 0) {
      // 기본 프로필 자동 생성 (타임아웃 적용)
      await Promise.race([
        pool.query(
          `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit) VALUES (?, ?, ?, '', '', '', '', '')`,
          [userId, userId, '/avatars/user.jpg']
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
      ]);
    }
    
    // 전체 목록 반환 (타임아웃 적용)
    const listResult = await Promise.race([
      pool.query(
        "SELECT * FROM user_personas WHERE userId = ? ORDER BY createdAt DESC",
        [userId]
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
    ]);
    
    const [rows] = listResult as any;
    
    return NextResponse.json({ ok: true, personas: rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 에러시 폴백 데이터 반환
    return NextResponse.json({ ok: true, personas: fallbackPersonas, fallback: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// POST /api/persona
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { userId, name, avatar, gender, age, job, info, habit } = data;
  if (!userId || !name) return NextResponse.json({ ok: false, error: 'userId, name required' }, { status: 400, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }});
  
  try {
    // 연결 테스트
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    
    // INSERT 쿼리 (타임아웃 적용)
    const result = await Promise.race([
      pool.query(
        `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, avatar, gender, age, job, info, habit]
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
    ]);
    
    const [insertResult] = result as any;
    
    return NextResponse.json({ ok: true, id: insertResult.insertId }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 에러시 임시 ID 반환
    const tempId = Date.now();
    return NextResponse.json({ ok: true, id: tempId, fallback: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
} 