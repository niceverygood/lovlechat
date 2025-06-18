import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
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
    // 연결 테스트
    await pool.query("SELECT 1");
    
    const [rows] = await pool.query(
      `SELECT c.characterId, c.personaId, c.message as lastMessage, c.sender as lastSender, c.createdAt as lastMessageAt,
              up.name as personaName, up.avatar as personaAvatar,
              p.name, p.profileImg
         FROM (
           SELECT characterId, personaId, MAX(createdAt) as lastMessageAt
           FROM chats
           GROUP BY characterId, personaId
         ) t
         JOIN chats c ON c.characterId = t.characterId AND c.personaId = t.personaId AND c.createdAt = t.lastMessageAt
         JOIN character_profiles p ON c.characterId = p.id
         LEFT JOIN user_personas up ON c.personaId = up.id
        ORDER BY c.createdAt DESC`
    );
    return NextResponse.json({ ok: true, chats: rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("DB error:", err);
    
    // DB 연결 에러시 폴백 데이터 반환
    if ((err as any)?.code === 'ETIMEDOUT' || (err as any)?.code === 'ECONNREFUSED') {
      console.log("DB connection failed, returning fallback chat list");
      return NextResponse.json({ ok: true, chats: fallbackChats, fallback: true }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    } });
  }
} 