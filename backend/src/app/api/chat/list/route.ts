import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

// CORS 헤더 공통 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, cache-control, x-requested-with',
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  
  // userId 필수 검증
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'userId is required' },
      { 
        status: 400,
        headers: CORS_HEADERS
      }
    );
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
    // 직접 JOIN을 사용하여 사용자의 채팅 리스트를 가져옴
    const rows = await executeQuery(
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
       LIMIT 50`,
      [userId]
    );
    
    return NextResponse.json({ ok: true, chats: rows }, {
      headers: CORS_HEADERS
    });
  } catch (err) {
    console.error("DB error:", err);
    
    // DB 에러시 항상 폴백 데이터 반환
    return NextResponse.json({ ok: true, chats: fallbackChats, fallback: true }, {
      headers: CORS_HEADERS
    });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: CORS_HEADERS,
      }
  );
} 