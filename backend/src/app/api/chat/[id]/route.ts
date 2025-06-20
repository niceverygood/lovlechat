import { NextRequest } from "next/server";
import { executeQuery } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse, fallbackResponse } from "@/lib/cors";

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
    return errorResponse("characterId와 personaId가 모두 필요합니다.", 400);
  }
  
  // characterId만 숫자 검증 (personaId는 문자열)
  if (isNaN(Number(characterId))) {
    return errorResponse("유효한 숫자 형식의 characterId가 필요합니다.", 400);
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
         LIMIT 100`,
        [personaId, characterId],
        3000 // 타임아웃 최적화
      ),
      executeQuery(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [personaId, characterId],
        1500 // 호감도 조회는 더 빠르게
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
    
    return successResponse({ 
      messages, 
      favor,
      total: messages.length,
      characterId: Number(characterId),
      personaId: personaId // 문자열 그대로 반환
    });
    
  } catch (err: any) {
    console.error("채팅 조회 에러:", err);
    
    // 타임아웃 에러시 폴백 데이터 반환
    if (err.message?.includes('TIMEOUT')) {
      return fallbackResponse({ 
        messages: fallbackMessages, 
        favor: 0,
        total: fallbackMessages.length,
        characterId: Number(characterId),
        personaId: personaId
      }, "네트워크 지연으로 기본 데이터를 표시합니다.");
    }
    
    // 기타 에러는 서버 에러로 처리
    return errorResponse("채팅 내역을 불러오는 중 오류가 발생했습니다.", 500);
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 