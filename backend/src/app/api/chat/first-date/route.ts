import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const personaId = searchParams.get('personaId');
  const characterId = searchParams.get('characterId');

  if (!personaId || !characterId) {
    return NextResponse.json(
      { ok: false, error: "Missing personaId or characterId" },
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
    // 최적화된 첫 데이트 조회
    const rows = await executeQuery(
      "SELECT MIN(createdAt) as firstDate FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId],
      3000
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: true, firstDate: null },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const firstDate = (rows[0] as any).firstDate;
    return NextResponse.json(
      { ok: true, firstDate },
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
    
    // DB 에러시 기본값 반환
    return NextResponse.json(
      { ok: true, firstDate: null, fallback: true },
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