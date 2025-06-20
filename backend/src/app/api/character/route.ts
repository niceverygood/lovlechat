import { NextRequest } from "next/server";
import { executeQuery, executeMutation, executeQueryWithCache, parseJsonSafely } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse, fallbackResponse } from "@/lib/cors";

/**
 * Character API - AI 상대방 캐릭터 관리 (최적화됨)
 * 
 * 개념 정리:
 * - User: 구글 로그인한 실제 사용자 1명 (Firebase Auth uid)
 * - Persona: User가 만드는 여러 개의 프로필 (프론트: "멀티프로필")  
 * - Character: AI 상대방 캐릭터 (이 API에서 관리하는 대상)
 * 
 * Character는 User가 채팅할 AI 상대방
 * - 복잡한 성격, 배경, 첫 상황/대사 등 상세한 설정 포함
 * - User가 직접 생성하거나 미리 만들어진 캐릭터
 * - User의 여러 Persona로 동일한 Character와 채팅 가능
 */

// 데이터 정규화 함수
function normalizeCharacterData(data: any) {
  return {
    userId: String(data.userId || '').trim(),
    profileImg: data.profileImg || '/imgdefault.jpg',
    name: String(data.name || '').trim().slice(0, 15),
    age: data.age ? Math.min(Math.max(parseInt(data.age) || 0, 0), 150) : 0,
    job: data.job ? String(data.job).trim().slice(0, 15) : '',
    oneLiner: data.oneLiner ? String(data.oneLiner).trim().slice(0, 80) : '',
    background: data.background ? String(data.background).trim().slice(0, 700) : '',
    personality: data.personality ? String(data.personality).trim().slice(0, 300) : '',
    habit: data.habit ? String(data.habit).trim().slice(0, 100) : '',
    like: data.like ? String(data.like).trim().slice(0, 50) : '',
    dislike: data.dislike ? String(data.dislike).trim().slice(0, 50) : '',
    extraInfos: Array.isArray(data.extraInfos) ? data.extraInfos.slice(0, 10) : [],
    gender: data.gender || '',
    scope: data.scope || 'private',
    roomCode: data.roomCode || '',
    category: data.category || '',
    selectedTags: Array.isArray(data.selectedTags) ? data.selectedTags.slice(0, 20) : [],
    attachments: Array.isArray(data.attachments) ? data.attachments.slice(0, 5) : [],
    firstScene: data.firstScene ? String(data.firstScene).trim().slice(0, 200) : '',
    firstMessage: data.firstMessage ? String(data.firstMessage).trim().slice(0, 200) : '',
    backgroundImg: data.backgroundImg || '/imgdefault.jpg'
  };
}

// 폴백 캐릭터 데이터 (성능 최적화)
const FALLBACK_CHARACTERS = [
  {
    id: "1",
    profileImg: "/imgdefault.jpg",
    name: "아이유",
    age: "30",
    job: "가수",
    oneLiner: "안녕하세요! 아이유입니다.",
    selectedTags: ["친절한", "밝은", "음악"],
    attachments: null,
    firstScene: "카페",
    firstMessage: "안녕하세요! 오늘 하루는 어떠셨나요?",
    backgroundImg: "/imgdefault.jpg"
  },
  {
    id: "2", 
    profileImg: "/imgdefault.jpg",
    name: "김태연",
    age: "35",
    job: "가수",
    oneLiner: "소녀시대 태연입니다!",
    selectedTags: ["리더십", "실력파", "카리스마"],
    attachments: null,
    firstScene: "연습실",
    firstMessage: "안녕! 오늘도 열심히 해보자!",
    backgroundImg: "/imgdefault.jpg"
  }
];

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // 필수 필드 검증
    if (!data.userId || !data.name?.trim()) {
      return errorResponse("userId와 name은 필수입니다.", 400);
    }
    
    const normalizedData = normalizeCharacterData(data);
    
    // 최적화된 INSERT 쿼리
    const result = await executeMutation(
      `INSERT INTO character_profiles
        (userId, profileImg, name, age, job, oneLiner, background, personality, habit, 
         likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, 
         firstScene, firstMessage, backgroundImg, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        normalizedData.userId,
        normalizedData.profileImg,
        normalizedData.name,
        normalizedData.age,
        normalizedData.job,
        normalizedData.oneLiner,
        normalizedData.background,
        normalizedData.personality,
        normalizedData.habit,
        normalizedData.like,
        normalizedData.dislike,
        JSON.stringify(normalizedData.extraInfos),
        JSON.stringify(normalizedData.gender),
        normalizedData.scope,
        normalizedData.roomCode,
        normalizedData.category,
        JSON.stringify(normalizedData.selectedTags),
        JSON.stringify(normalizedData.attachments),
        normalizedData.firstScene,
        normalizedData.firstMessage,
        normalizedData.backgroundImg
      ],
      6000 // 타임아웃 최적화
    );
    
    const [insertResult] = result as any;
    
    return successResponse({ 
      id: insertResult.insertId,
      message: "캐릭터가 성공적으로 생성되었습니다!"
    });
    
  } catch (err) {
    console.error("Character creation error:", err);
    
    // 폴백 처리
    const tempId = Date.now();
    return fallbackResponse({ 
      id: tempId,
      message: "캐릭터가 임시 저장되었습니다. 잠시 후 다시 확인해주세요."
    });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  
  try {
    if (userId) {
      // 사용자별 캐릭터 조회 (캐시 적용)
      const rows = await executeQueryWithCache(
        `SELECT id, profileImg, name, age, job, oneLiner, category, tags, attachments, 
                likes, dislikes, firstScene, firstMessage, backgroundImg 
         FROM character_profiles 
         WHERE userId = ?
         ORDER BY createdAt DESC LIMIT 10`,
        [userId],
        180, // 3분 캐시
        5000
      );
      
      // 프론트엔드 호환성을 위해 selectedTags 및 like/dislike 필드 변환
      const charactersWithSelectedTags = rows.map((char: any) => ({
        ...char,
        like: char.likes,       // DB likes → 프론트 like
        dislike: char.dislikes, // DB dislikes → 프론트 dislike
        selectedTags: parseJsonSafely(char.tags) || []
      }));
      
      return successResponse({ characters: charactersWithSelectedTags });
    }
    
    // 전체 조회 (For You) - 캐시 적용
    const rows = await executeQueryWithCache(
      `SELECT id, profileImg, name, age, job, oneLiner, tags, attachments, 
              likes, dislikes, firstScene, firstMessage, backgroundImg 
       FROM character_profiles 
       WHERE scope = '공개' 
       ORDER BY RAND() LIMIT 5`,
      [],
      300, // 5분 캐시
      4000
    );
    
    // 프론트엔드 호환성을 위해 selectedTags 및 like/dislike 필드 변환
    const charactersWithSelectedTags = rows.map((char: any) => ({
      ...char,
      like: char.likes,       // DB likes → 프론트 like
      dislike: char.dislikes, // DB dislikes → 프론트 dislike
      selectedTags: parseJsonSafely(char.tags) || []
    }));
    
    return successResponse({ characters: charactersWithSelectedTags });
    
  } catch (err) {
    console.error("Character GET error:", err);
    
    // 폴백 데이터 반환
    return fallbackResponse({ 
      characters: FALLBACK_CHARACTERS 
    }, "데이터를 임시로 제공하고 있습니다.");
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 