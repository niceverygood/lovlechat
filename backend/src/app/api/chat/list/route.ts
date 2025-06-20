import { NextRequest } from "next/server";
import { executeQuery, executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

/**
 * Chat List API - 사용자의 채팅 목록 조회 (완전 최적화)
 */

// 환경별 설정 최적화
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const CACHE_DURATION = isVercel ? 180 : 120; // 3분/2분 캐싱
const MAX_CHAT_LIST = 50; // 최대 채팅 목록 수

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return errorResponse("userId가 필요합니다.", 400);
  }

  try {
    // 완전한 SQL 쿼리 - 복잡한 JOIN 최적화
    const chatList = await executeQueryWithCache(
      `SELECT 
         c1.characterId, 
         c1.personaId, 
         c1.message as lastMessage,
         c1.sender as lastSender,
         c1.createdAt as lastMessageAt,
         p.name as personaName, 
         p.avatar as personaAvatar,
         cp.name, 
         cp.profileImg
       FROM chats c1
       INNER JOIN (
         SELECT 
           c2.characterId, 
           c2.personaId, 
           MAX(c2.createdAt) as maxCreatedAt
         FROM chats c2
         INNER JOIN personas p2 ON c2.personaId = p2.id
         WHERE p2.userId = ?
         GROUP BY c2.characterId, c2.personaId
       ) latest ON c1.characterId = latest.characterId 
                   AND c1.personaId = latest.personaId 
                   AND c1.createdAt = latest.maxCreatedAt
       JOIN personas p ON c1.personaId = p.id
       JOIN character_profiles cp ON c1.characterId = cp.id
       ORDER BY c1.createdAt DESC 
       LIMIT ?`,
      [userId, MAX_CHAT_LIST],
      CACHE_DURATION
    );

    // 데이터 후처리 (최적화)
    const processedChatList = (chatList || []).map((chat: any) => ({
      characterId: chat.characterId,
      personaId: chat.personaId,
      lastMessage: chat.lastMessage || '',
      lastSender: chat.lastSender || 'user',
      lastMessageAt: chat.lastMessageAt,
      personaName: chat.personaName || '알 수 없는 페르소나',
      personaAvatar: chat.personaAvatar || '/imgdefault.jpg',
      characterName: chat.name || '알 수 없는 캐릭터',
      characterProfileImg: chat.profileImg || '/imgdefault.jpg'
    }));

    return successResponse({ 
      chats: processedChatList,
      count: processedChatList.length,
      cached: true,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Chat list 조회 에러:", error.message);
    
    // 에러 시 빈 배열 반환 (서비스 연속성)
    return successResponse({ 
      chats: [],
      fallback: true,
      error: error.message,
      message: "채팅 목록을 불러올 수 없습니다."
    });
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 