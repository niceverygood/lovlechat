import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

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
    // 채팅 메시지와 호감도를 병렬로 조회
    const [messages, favorRows] = await Promise.all([
      executeQuery(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT 50",
        [personaId, id],
        5000
      ),
      executeQuery(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [personaId, id],
        2000
      ).catch(() => []) // 호감도 조회 실패해도 메시지는 반환
    ]);
    
    const favor = Array.isArray(favorRows) && favorRows.length > 0 ? favorRows[0]?.favor : 0;
    
    return NextResponse.json(
      { ok: true, messages, favor },
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
} 