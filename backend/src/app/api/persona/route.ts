import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";

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
    // 기본 프로필 존재 여부 확인
    const existRows = await executeQuery(
      "SELECT * FROM user_personas WHERE userId = ? AND name = ?",
      [userId, userId],
      4000
    );
    
    if (!Array.isArray(existRows) || existRows.length === 0) {
      // 기본 프로필 자동 생성
      await executeMutation(
        `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit) VALUES (?, ?, ?, '', '', '', '', '')`,
        [userId, userId, '/avatars/user.jpg'],
        5000
      );
    }
    
    // 전체 목록 반환
    const rows = await executeQuery(
      "SELECT * FROM user_personas WHERE userId = ? ORDER BY createdAt DESC",
      [userId],
      4000
    );
    
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
  const { userId, name, avatar, gender, age, job, info, habit, personality, interests, background } = data;
  if (!userId || !name) return NextResponse.json({ ok: false, error: 'userId, name required' }, { status: 400, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }});
  
  try {
    // 최적화된 INSERT 쿼리
    const result = await executeMutation(
      `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit, personality, interests, background) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, avatar || '/avatars/user.jpg', gender || '', age || '', job || '', info || '', habit || '', personality || '', interests || '', background || ''],
      6000
    );
    
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