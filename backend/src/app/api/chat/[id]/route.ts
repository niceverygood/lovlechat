import { NextRequest } from "next/server";
import { executeQuery, executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

/**
 * Chat Messages API - 특정 캐릭터와의 채팅 메시지 조회 (완전 최적화)
 */

// 환경별 설정 최적화
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const CACHE_DURATION = isVercel ? 120 : 60; // 2분/1분 캐싱 (메시지는 자주 변경됨)
const MAX_MESSAGES = 100; // 최대 메시지 수

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const characterId = params.id;
  const personaId = req.nextUrl.searchParams.get('personaId');

  if (!characterId || !personaId) {
    return errorResponse("characterId와 personaId가 필요합니다.", 400);
  }

  try {
    // 완전한 SQL 쿼리들을 병렬로 실행 (성능 최적화)
    const [messages, favor] = await Promise.all([
      // 메시지 조회 쿼리 (완전 버전)
      executeQueryWithCache(
        `SELECT id, personaId, characterId, message, sender, characterName, 
                characterProfileImg, characterAge, characterJob, createdAt,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
         FROM chats 
         WHERE personaId = ? AND characterId = ? 
         ORDER BY createdAt ASC 
         LIMIT ?`,
        [personaId, characterId, MAX_MESSAGES],
        CACHE_DURATION
      ),
      
      // 호감도 조회 쿼리 (완전 버전)
      executeQueryWithCache(
        `SELECT favor 
         FROM character_favors 
         WHERE personaId = ? AND characterId = ?`,
        [personaId, characterId],
        CACHE_DURATION * 2 // 호감도는 더 오래 캐싱
      )
    ]);

    // 데이터 후처리 (최적화)
    const processedMessages = (messages || []).map((msg: any) => ({
      id: msg.id,
      sender: msg.sender,
      message: msg.message || '',
      characterName: msg.characterName || '',
      characterProfileImg: msg.characterProfileImg || '/imgdefault.jpg',
      characterAge: msg.characterAge || 0,
      characterJob: msg.characterJob || '',
      createdAt: msg.createdAt,
      timestamp: msg.timestamp
    }));

    const currentFavor = favor && favor.length > 0 ? favor[0].favor || 0 : 0;

    return successResponse({
      messages: processedMessages,
      favor: currentFavor,
      count: processedMessages.length,
      cached: true,
      pagination: {
        page: 1,
        limit: MAX_MESSAGES,
        total: processedMessages.length,
        hasMore: processedMessages.length >= MAX_MESSAGES
      }
    });

  } catch (error: any) {
    console.error("Chat messages 조회 에러:", error.message);
    
    // 에러 시 빈 배열 반환 (서비스 연속성)
    return successResponse({
      messages: [],
      favor: 0,
      fallback: true,
      error: error.message,
      message: "채팅 메시지를 불러올 수 없습니다."
    });
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 