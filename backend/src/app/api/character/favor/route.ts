import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/character/favor?userId=xxx&characterId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const characterId = req.nextUrl.searchParams.get('characterId');
  
  if (!userId || !characterId) {
    return NextResponse.json(
      { ok: false, error: 'userId and characterId required' },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }

  try {
    // 연결 테스트
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    
    // 호감도 조회 (타임아웃 적용)
    const result = await Promise.race([
      pool.query(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [userId, characterId]
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
    ]);
    
    const [rows] = result as any;
    const favor = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any)?.favor : 0;
    
    return NextResponse.json(
      { ok: true, favor },
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
    
    // DB 에러시 기본 호감도 반환
    return NextResponse.json(
      { ok: true, favor: 0, fallback: true },
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