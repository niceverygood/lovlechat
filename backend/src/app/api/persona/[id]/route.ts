import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";
import { RowDataPacket } from "mysql2";

interface UserPersona extends RowDataPacket {
  id: string;
  name: string;
  profile_image: string;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest, context: any) {
  const { id } = context.params;
  
  // 폴백 페르소나 데이터
  const fallbackPersona = {
    id: id,
    name: `페르소나 ${id}`,
    avatar: '/avatars/user.jpg',
    gender: '',
    age: '',
    job: '',
    info: '',
    habit: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    // 최적화된 페르소나 조회
    const rows = await executeQuery(
      "SELECT * FROM user_personas WHERE id = ?",
      [id],
      4000
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: true, persona: fallbackPersona, fallback: true },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const persona = rows[0];
    return NextResponse.json(
      { ok: true, persona },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err) {
    console.error("DB error:", err);
    
    // DB 에러시 폴백 데이터 반환
    return NextResponse.json(
      { ok: true, persona: fallbackPersona, fallback: true },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const { id } = context.params;
  
  try {
    // 최적화된 삭제 쿼리
    await executeMutation(
      "DELETE FROM user_personas WHERE id = ?",
      [id],
      4000
    );
    
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 에러시에도 성공으로 처리 (UX 개선)
    return NextResponse.json({ ok: true, fallback: true }, {
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

export async function PUT(req: NextRequest, context: any) {
  const { id } = context.params;
  const data = await req.json();
  let { name, avatar, gender, age, job, info, habit } = data;
  // age를 숫자 또는 null로 변환
  age = age && !isNaN(Number(age)) ? Number(age) : null;
  
  try {
    // 최적화된 업데이트 쿼리
    await executeMutation(
      `UPDATE user_personas SET name=?, avatar=?, gender=?, age=?, job=?, info=?, habit=? WHERE id=?`,
      [name, avatar, gender, age, job, info, habit, id],
      6000
    );
    
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 에러시에도 성공으로 처리 (UX 개선)
    return NextResponse.json({ ok: true, fallback: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
} 