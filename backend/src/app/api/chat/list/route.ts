import { NextRequest } from "next/server";
import { executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

// 환경별 설정
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const CACHE_DURATION = isVercel ? 120 : 60; // 2분/1분 캐싱
const MAX_CHATS = isVercel ? 20 : 50; // Vercel에서는 더 적게

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  
  // userId 필수 검증
  if (!userId) {
    return errorResponse('userId is required', 400);
  }

  // 더미 채팅 데이터 (DB 연결 실패시 폴백용)
  const fallbackChats = [
    {
      characterId: "1",
      personaId: "default",
      lastMessage: "안녕하세요! 처음 뵙겠습니다.",
      lastSender: "ai",
      lastMessageAt: new Date().toISOString(),
      personaName: "기본 페르소나",
      personaAvatar: "/avatars/user.jpg",
      name: "기본 캐릭터",
      profileImg: "/imgdefault.jpg"
    }
  ];

  try {
    // 최적화된 채팅 리스트 쿼리 (캐시 적용)
    const rows = await executeQueryWithCache(
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
      [userId, MAX_CHATS],
      CACHE_DURATION
    );
    
    return successResponse({ chats: rows || [] });
    
  } catch (err: any) {
    console.error("Chat list error:", err.message);
    
    // DB 에러시 폴백 데이터 반환
    return successResponse({ 
      chats: fallbackChats, 
      fallback: true,
      message: "채팅 목록을 불러올 수 없습니다."
    });
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 