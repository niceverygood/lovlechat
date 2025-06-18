import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/chat/[id] - 특정 채팅방의 메시지 조회
export async function GET(req: NextRequest, context: any) {
  const { id } = context.params;
  const personaId = req.nextUrl.searchParams.get('personaId');
  
  if (!personaId) {
    return NextResponse.json(
      { ok: false, error: 'personaId required' },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC",
      [personaId, id]
    );
    
    // favor 조회
    const [favorRows] = await pool.query(
      "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
      [personaId, id]
    );
    const favor = Array.isArray(favorRows) && favorRows.length > 0 ? (favorRows[0] as any)?.favor : 0;
    
    return NextResponse.json(
      { ok: true, messages: rows, favor },
      {
        headers: {
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
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
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
} 