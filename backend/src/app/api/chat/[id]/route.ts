import { NextRequest } from "next/server";
import { executeQuery, executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

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

// 환경별 설정 (수정됨)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const MESSAGES_PER_PAGE = isVercel ? 30 : 50; // Vercel에서 더 적게 로딩
const CACHE_DURATION = isVercel ? 180 : 120; // 3분/2분 캐싱

// GET /api/chat/[id] - 채팅 내역 조회 (Vercel 최적화)
export async function GET(req: NextRequest, context: any) {
  const { id: characterId } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const personaId = searchParams.get('personaId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || MESSAGES_PER_PAGE.toString()), 100);
  
  // 입력 검증
  if (!characterId || !personaId) {
    return errorResponse("characterId와 personaId가 필요합니다.", 400);
  }
  
  if (isNaN(Number(characterId))) {
    return errorResponse("유효한 characterId가 필요합니다.", 400);
  }

  if (page < 1 || limit < 1) {
    return errorResponse("올바른 페이지네이션이 필요합니다.", 400);
  }

  const offset = (page - 1) * limit;

  try {
    // 간단한 쿼리로 최적화 (ORDER BY 완전한 절 포함)
    const messagesQuery = `
      SELECT id, personaId, characterId, message, sender, characterName, 
             characterProfileImg, characterAge, characterJob, createdAt,
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
      FROM chats 
      WHERE personaId = ? AND characterId = ? 
      ORDER BY createdAt ASC 
      LIMIT ?
    `;
    
    const favorQuery = `
      SELECT favor FROM character_favors 
      WHERE personaId = ? AND characterId = ?
    `;

    // 병렬 조회 (개선됨)
    const [messagesResult, favorResult] = await Promise.allSettled([
      executeQueryWithCache(messagesQuery, [personaId, characterId, limit], CACHE_DURATION),
      executeQueryWithCache(favorQuery, [personaId, characterId], CACHE_DURATION)
    ]);
    
    // 메시지 처리
    let messages = fallbackMessages;
    if (messagesResult.status === 'fulfilled' && Array.isArray(messagesResult.value) && messagesResult.value.length > 0) {
      messages = messagesResult.value;
    } else if (messagesResult.status === 'rejected') {
      console.error("메시지 조회 실패:", messagesResult.reason.message);
    }
    
    // 호감도 처리
    let favor = 0;
    if (favorResult.status === 'fulfilled' && Array.isArray(favorResult.value) && favorResult.value.length > 0) {
      favor = (favorResult.value[0] as any)?.favor || 0;
    }
    
    // 응답 최적화
    return successResponse({ 
      messages, 
      favor,
      pagination: {
        page,
        limit,
        total: messages.length,
        hasMore: messages.length === limit
      },
      characterId: Number(characterId),
      personaId: personaId
    });
    
  } catch (err: any) {
    console.error("채팅 조회 에러:", err.message);
    
    // 타임아웃이나 연결 오류시 폴백
    if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return successResponse({ 
        messages: fallbackMessages, 
        favor: 0,
        pagination: {
          page: 1,
          limit: MESSAGES_PER_PAGE,
          total: 1,
          hasMore: false
        },
        characterId: Number(characterId),
        personaId: personaId,
        fallback: true
      });
    }
    
    return errorResponse("채팅 내역을 불러올 수 없습니다.", 500);
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 