import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  // 모든 캐릭터-페르소나 조합별로 가장 최근 메시지 1개씩만 GROUP BY로 추출
  try {
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
    return NextResponse.json({ ok: true, chats: rows });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
} 