import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

// 폴백 메시지 데이터
const fallbackMessages = [
  {
    id: 1,
    personaId: "default",
    characterId: "1",
    message: "안녕하세요! 처음 뵙겠습니다. 어떤 이야기를 나누고 싶으신가요?",
    sender: "ai",
    characterName: "기본 캐릭터",
    characterProfileImg: "/imgdefault.jpg",
    characterAge: 20,
    characterJob: "학생",
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString()
  }
];

// GET /api/chat/[id] - 특정 캐릭터와의 채팅 내역 조회
export async function GET(req: NextRequest, context: any) {
  const { id: characterId } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const personaId = searchParams.get('personaId');
  
  // 입력 검증 강화
  if (!characterId || !personaId) {
    return NextResponse.json(
      { ok: false, error: "characterId와 personaId가 모두 필요합니다." },
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
  
  // ID 형식 검증
  if (isNaN(Number(characterId)) || isNaN(Number(personaId))) {
    return NextResponse.json(
      { ok: false, error: "유효한 숫자 형식의 ID가 필요합니다." },
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
    // 채팅 메시지와 호감도를 병렬로 조회 (성능 최적화)
    const [messagesResult, favorResult] = await Promise.allSettled([
      executeQuery(
        `SELECT id, personaId, characterId, message, sender, characterName, 
                characterProfileImg, characterAge, characterJob, createdAt,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
         FROM chats 
         WHERE personaId = ? AND characterId = ? 
         ORDER BY createdAt ASC 
         LIMIT 100`, // 메시지 수 제한으로 성능 향상
        [personaId, characterId],
        4000 // 타임아웃 단축 (5초 → 4초)
      ),
      executeQuery(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [personaId, characterId],
        2000 // 호감도 조회는 더 빠르게
      )
    ]);
    
    // 메시지 결과 처리
    let messages = fallbackMessages;
    if (messagesResult.status === 'fulfilled' && Array.isArray(messagesResult.value)) {
      messages = messagesResult.value;
    } else if (messagesResult.status === 'rejected') {
      console.error("메시지 조회 실패:", messagesResult.reason);
    }
    
    // 호감도 결과 처리
    let favor = 0;
    if (favorResult.status === 'fulfilled' && 
        Array.isArray(favorResult.value) && 
        favorResult.value.length > 0) {
      favor = (favorResult.value[0] as any)?.favor || 0;
    } else if (favorResult.status === 'rejected') {
      console.warn("호감도 조회 실패 (비치명적):", favorResult.reason);
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        messages, 
        favor,
        total: messages.length,
        characterId: Number(characterId),
        personaId: Number(personaId)
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err: any) {
    console.error("채팅 조회 에러:", err);
    
    // 타임아웃 에러시 폴백 데이터 반환
    if (err.message?.includes('TIMEOUT')) {
      console.log("채팅 조회 타임아웃, 폴백 데이터 반환");
      return NextResponse.json(
        { 
          ok: true, 
          messages: fallbackMessages, 
          favor: 0, 
          fallback: true,
          total: fallbackMessages.length
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
    
    // 기타 에러는 서버 에러로 처리
    return NextResponse.json(
      { ok: false, error: "채팅 내역을 불러오는 중 오류가 발생했습니다." },
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