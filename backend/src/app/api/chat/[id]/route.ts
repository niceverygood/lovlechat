import { NextRequest } from "next/server";
import { executeQuery, executeQueryWithCache } from "@/lib/db-helper";
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

// 환경별 설정
const isVercel = process.env.VERCEL === '1';
const MESSAGES_PER_PAGE = isVercel ? 50 : 100; // Vercel에서는 더 적게
const CACHE_DURATION = isVercel ? 300 : 180; // Vercel에서는 더 긴 캐시

// GET /api/chat/[id] - 특정 캐릭터와의 채팅 내역 조회 (최적화)
export async function GET(req: NextRequest, context: any) {
  const { id: characterId } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const personaId = searchParams.get('personaId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || MESSAGES_PER_PAGE.toString());
  
  // 입력 검증 강화
  if (!characterId || !personaId) {
    return errorResponse("characterId와 personaId가 모두 필요합니다.", 400);
  }
  
  // characterId만 숫자 검증 (personaId는 문자열)
  if (isNaN(Number(characterId))) {
    return errorResponse("유효한 숫자 형식의 characterId가 필요합니다.", 400);
  }

  // 페이지네이션 검증
  if (page < 1 || limit < 1 || limit > 200) {
    return errorResponse("올바른 페이지네이션 매개변수가 필요합니다.", 400);
  }

  const offset = (page - 1) * limit;

  try {
    // 최신 메시지 우선 조회 (성능 최적화)
    const messagesQuery = `
      SELECT id, personaId, characterId, message, sender, characterName, 
             characterProfileImg, characterAge, characterJob, createdAt,
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
      FROM chats 
      WHERE personaId = ? AND characterId = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    
    const favorQuery = `
      SELECT favor FROM character_favors 
      WHERE personaId = ? AND characterId = ?
    `;
    
    const totalCountQuery = `
      SELECT COUNT(*) as total 
      FROM chats 
      WHERE personaId = ? AND characterId = ?
    `;

    // 메시지, 호감도, 총 개수를 병렬로 조회 (최적화)
    const [messagesResult, favorResult, totalResult] = await Promise.allSettled([
      executeQueryWithCache(
        messagesQuery,
        [personaId, characterId, limit, offset],
        page === 1 ? CACHE_DURATION : 60, // 첫 페이지는 더 긴 캐싱
        isVercel ? 10000 : 5000 // Vercel은 더 긴 타임아웃
      ),
      executeQueryWithCache(
        favorQuery,
        [personaId, characterId],
        CACHE_DURATION, // 호감도는 자주 변하지 않으므로 캐싱
        isVercel ? 5000 : 2000
      ),
      page === 1 ? executeQueryWithCache(
        totalCountQuery,
        [personaId, characterId],
        CACHE_DURATION,
        isVercel ? 5000 : 2000
      ) : Promise.resolve({ status: 'fulfilled', value: [{ total: 0 }] })
    ]);
    
    // 메시지 결과 처리
    let messages = fallbackMessages;
    if (messagesResult.status === 'fulfilled' && Array.isArray(messagesResult.value)) {
      // DESC로 조회했으므로 다시 ASC로 정렬
      messages = messagesResult.value.reverse();
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
    
    // 총 개수 처리
    let total = 0;
    if (totalResult.status === 'fulfilled' && 
        Array.isArray(totalResult.value) && 
        totalResult.value.length > 0) {
      total = (totalResult.value[0] as any)?.total || 0;
    }
    
    // 페이지네이션 정보
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return successResponse({ 
      messages, 
      favor,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      characterId: Number(characterId),
      personaId: personaId,
      cached: messagesResult.status === 'fulfilled' ? undefined : false
    });
    
  } catch (err: any) {
    console.error("채팅 조회 에러:", err);
    
    // 타임아웃 에러시 폴백 데이터 반환
    if (err.message?.includes('TIMEOUT') || err.code === 'ETIMEDOUT') {
      return fallbackResponse({ 
        messages: fallbackMessages, 
        favor: 0,
        pagination: {
          page: 1,
          limit: MESSAGES_PER_PAGE,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        characterId: Number(characterId),
        personaId: personaId
      }, "네트워크 지연으로 기본 데이터를 표시합니다.");
    }
    
    // DB 연결 에러시 재시도 권장
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return errorResponse("데이터베이스 연결 오류입니다. 잠시 후 다시 시도해주세요.", 503);
    }
    
    // 기타 에러는 서버 에러로 처리
    return errorResponse("채팅 내역을 불러오는 중 오류가 발생했습니다.", 500);
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 