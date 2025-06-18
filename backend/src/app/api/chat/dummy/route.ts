import { NextRequest, NextResponse } from "next/server";

// GET /api/chat/dummy?count=5
export async function GET(req: NextRequest) {
  const count = req.nextUrl.searchParams.get('count') || '5';
  const dummyCount = parseInt(count, 10) || 5;
  
  // 더미 채팅 데이터 생성
  const dummyChats = Array.from({ length: dummyCount }, (_, i) => ({
    id: `dummy-${i + 1}`,
    characterId: `char-${i + 1}`,
    personaId: `persona-${i + 1}`,
    lastMessage: `더미 메시지 ${i + 1}`,
    lastSender: i % 2 === 0 ? 'user' : 'ai',
    lastMessageAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
    characterName: `캐릭터 ${i + 1}`,
    characterProfileImg: '/imgdefault.jpg',
    personaName: `페르소나 ${i + 1}`,
    personaAvatar: '/avatars/user.jpg'
  }));

  return NextResponse.json(
    { ok: true, chats: dummyChats },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    }
  );
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