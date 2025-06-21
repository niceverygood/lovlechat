import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from '../../../../lib/db-helper';

// CORS 헤더 공통 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, cache-control, x-requested-with',
};

// GET /api/chat/dummy?count=5
export async function GET(req: NextRequest) {
  try {
    const count = req.nextUrl.searchParams.get('count') || '5';
    const dummyCount = parseInt(count, 10) || 5;
    
    console.log(`게스트 모드 채팅목록 생성 요청: ${dummyCount}개`);

    // 실제 DB에서 공개 캐릭터 데이터 가져오기
    const characters = await executeQuery(
      `SELECT id, profileImg, name, age, job, firstMessage, oneLiner
       FROM character_profiles 
       WHERE scope = '공개' 
       ORDER BY RAND() 
       LIMIT ?`,
      [dummyCount]
    );

    console.log(`DB에서 가져온 캐릭터 수: ${characters.length}`);

    // 채팅목록 형태로 변환
    const guestChats = characters.map((char: any, i: number) => ({
      id: `guest-chat-${char.id}`,
      characterId: char.id.toString(),
      personaId: `guest-persona-${i + 1}`, // 게스트용 더미 persona ID
      lastMessage: char.firstMessage || char.oneLiner || `${char.name}와 대화를 시작해보세요!`,
      lastSender: 'ai',
      lastMessageAt: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(), // 30분씩 차이
      name: char.name,
      profileImg: char.profileImg || '/imgdefault.jpg',
      personaName: '게스트', // 게스트 모드 표시
      personaAvatar: '/imgdefault.jpg' // 게스트 기본 아바타
    }));

    console.log(`생성된 게스트 채팅목록: ${guestChats.length}개`);

    return NextResponse.json(
      { ok: true, chats: guestChats },
      {
        headers: CORS_HEADERS
      }
    );
  } catch (error) {
    console.error('게스트 채팅목록 생성 오류:', error);
    
    // 오류 시 기본 더미 데이터 반환
    const fallbackChats = Array.from({ length: 5 }, (_, i) => ({
      id: `fallback-${i + 1}`,
      characterId: `char-${i + 1}`,
      personaId: `guest-persona-${i + 1}`,
      lastMessage: `AI 캐릭터와 대화해보세요!`,
      lastSender: 'ai',
      lastMessageAt: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(),
      name: `캐릭터 ${i + 1}`,
      profileImg: '/imgdefault.jpg',
      personaName: '게스트',
      personaAvatar: '/imgdefault.jpg'
    }));

    return NextResponse.json(
      { ok: true, chats: fallbackChats },
      {
        headers: CORS_HEADERS
      }
    );
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