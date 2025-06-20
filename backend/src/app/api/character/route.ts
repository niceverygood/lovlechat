import { NextRequest } from "next/server";
import { executeQuery, executeMutation, executeQueryWithCache, parseJsonSafely } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

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

// 환경별 설정 최적화
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const CACHE_DURATION = isVercel ? 600 : 300; // 10분/5분 장기 캐싱 (캐릭터는 자주 변경되지 않음)
const PUBLIC_CACHE_DURATION = isVercel ? 900 : 600; // 공개 캐릭터는 더 오래 캐싱
const MAX_USER_CHARACTERS = 10;
const MAX_PUBLIC_CHARACTERS = 5;

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
  }
];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  
  try {
    if (userId) {
      // 사용자 캐릭터 조회 (강력한 캐싱)
      const userCharacters = await executeQueryWithCache(
        `SELECT id, profileImg, name, age, job, oneLiner, category, tags, attachments, 
                likes, dislikes, firstScene, firstMessage, backgroundImg 
         FROM character_profiles 
         WHERE userId = ?
         ORDER BY createdAt DESC 
         LIMIT ?`,
        [userId, MAX_USER_CHARACTERS],
        CACHE_DURATION
      );

      return successResponse({ 
        characters: userCharacters || [],
        type: 'user_characters',
        cached: true,
        count: userCharacters?.length || 0
      });
      
    } else {
      // 공개 캐릭터 조회 (더 강력한 캐싱)
      const publicCharacters = await executeQueryWithCache(
        `SELECT id, profileImg, name, age, job, oneLiner, tags, attachments, 
                likes, dislikes, firstScene, firstMessage, backgroundImg 
         FROM character_profiles 
         WHERE scope = '공개' 
         ORDER BY RAND() 
         LIMIT ?`,
        [MAX_PUBLIC_CHARACTERS],
        PUBLIC_CACHE_DURATION
      );

      return successResponse({ 
        characters: publicCharacters || [],
        type: 'public_characters',
        cached: true,
        count: publicCharacters?.length || 0
      });
    }
    
  } catch (error: any) {
    console.error('Character 조회 에러:', error.message);
    
    // 에러 시 빈 배열 반환 (서비스 연속성)
    return successResponse({ 
      characters: [],
      fallback: true,
      error: error.message,
      message: "캐릭터 데이터를 불러올 수 없습니다."
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { 
      userId, name, age, job, profileImg, oneLiner, background, 
      personality, habit, likes, dislikes, extraInfos, gender, 
      scope, roomCode, category, tags, attachments, firstScene, 
      firstMessage, backgroundImg 
    } = data;

    if (!userId || !name?.trim()) {
      return errorResponse('userId와 name은 필수입니다.', 400);
    }

    // 데이터 검증 및 정규화 (강화)
    const normalizedData = {
      name: String(name).trim().slice(0, 50),
      age: age ? Math.min(Math.max(parseInt(age) || 20, 1), 200) : 20,
      job: job ? String(job).trim().slice(0, 30) : '',
      profileImg: profileImg || '/imgdefault.jpg',
      oneLiner: oneLiner ? String(oneLiner).trim().slice(0, 100) : '',
      background: background ? String(background).trim().slice(0, 500) : '',
      personality: personality ? String(personality).trim().slice(0, 200) : '',
      habit: habit ? String(habit).trim().slice(0, 100) : '',
      likes: likes ? String(likes).trim().slice(0, 200) : '',
      dislikes: dislikes ? String(dislikes).trim().slice(0, 200) : '',
      extraInfos: JSON.stringify(extraInfos || []),
      gender: gender || '설정하지 않음',
      scope: scope || '비공개',
      roomCode: roomCode || '',
      category: category ? String(category).trim().slice(0, 50) : '기타',
      tags: JSON.stringify(tags || []),
      attachments: JSON.stringify(attachments || []),
      firstScene: firstScene ? String(firstScene).trim().slice(0, 100) : '',
      firstMessage: firstMessage ? String(firstMessage).trim().slice(0, 500) : '',
      backgroundImg: backgroundImg || '/imgdefault.jpg'
    };

    // 완전한 INSERT 쿼리
    const result = await executeMutation(
      `INSERT INTO character_profiles (
        userId, name, age, job, profileImg, oneLiner, background, personality, 
        habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, 
        tags, attachments, firstScene, firstMessage, backgroundImg, 
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId, normalizedData.name, normalizedData.age, normalizedData.job,
        normalizedData.profileImg, normalizedData.oneLiner, normalizedData.background,
        normalizedData.personality, normalizedData.habit, normalizedData.likes,
        normalizedData.dislikes, normalizedData.extraInfos, normalizedData.gender,
        normalizedData.scope, normalizedData.roomCode, normalizedData.category,
        normalizedData.tags, normalizedData.attachments, normalizedData.firstScene,
        normalizedData.firstMessage, normalizedData.backgroundImg
      ]
    );

    if (result.success && result.insertId) {
      return successResponse({ 
        id: result.insertId,
        message: '캐릭터가 성공적으로 생성되었습니다!',
        character: {
          id: result.insertId,
          userId,
          ...normalizedData,
          createdAt: new Date().toISOString()
        }
      });
    } else {
      throw new Error('캐릭터 생성 실패');
    }
    
  } catch (error: any) {
    console.error('Character 생성 에러:', error.message);
    
    return errorResponse(
      "캐릭터 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      500
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 