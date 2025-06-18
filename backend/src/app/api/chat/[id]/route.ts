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
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }

  // 폴백 채팅 데이터
  const fallbackMessages = [
    {
      id: 1,
      personaId: personaId,
      characterId: id,
      message: "안녕하세요! 처음 뵙겠습니다.",
      sender: "ai",
      createdAt: new Date().toISOString(),
      characterName: "캐릭터 " + id,
      characterProfileImg: "/imgdefault.jpg"
    }
  ];

  try {
    // 연결 테스트 (빠른 타임아웃)
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    
    // 채팅 메시지 조회 (타임아웃 설정)
    const chatResult = await Promise.race([
      pool.query(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT 50",
        [personaId, id]
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
    ]);
    
    const [rows] = chatResult as any;
    
    // 호감도 조회 (빠른 타임아웃)
    let favor = 0;
    try {
      const favorResult = await Promise.race([
        pool.query(
          "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
          [personaId, id]
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
      ]);
      const [favorRows] = favorResult as any;
      favor = Array.isArray(favorRows) && favorRows.length > 0 ? favorRows[0]?.favor : 0;
    } catch (favorErr) {
      console.log("Favor query failed, using default:", favorErr);
      favor = 0;
    }
    
    return NextResponse.json(
      { ok: true, messages: rows, favor },
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
      { ok: true, messages: fallbackMessages, favor: 0, fallback: true },
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
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
} 