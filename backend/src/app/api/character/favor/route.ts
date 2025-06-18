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
    const [rows] = await pool.query(
      "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
      [userId, characterId]
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
    return NextResponse.json(
      { ok: false, error: String(err) },
      { 
        status: 500,
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