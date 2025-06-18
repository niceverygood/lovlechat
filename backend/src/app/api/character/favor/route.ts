import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

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
    // 최적화된 호감도 조회
    const rows = await executeQuery(
      "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
      [userId, characterId],
      3000
    );
    
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