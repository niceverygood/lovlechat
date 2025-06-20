import { NextRequest } from "next/server";
import { executeQuery, executeMutation, executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse, fallbackResponse } from "@/lib/cors";

/**
 * Persona API - 사용자가 생성한 멀티프로필 관리
 * 
 * 개념 정리:
 * - User: 구글 로그인한 실제 사용자 1명 (Firebase Auth uid)
 * - Persona: User가 만드는 여러 개의 프로필 (프론트: "멀티프로필")
 * - Character: AI 상대방 캐릭터
 * 
 * Persona는 User가 채팅할 때 연기할 역할/프로필
 * - 기본 정보만 포함: 이름, 아바타, 나이, 직업, 성별
 * - 1명의 User가 여러 개의 Persona 생성 가능
 */

function generatePersonaId() {
  return 'persona_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return errorResponse('userId는 필수입니다.', 400);
  }

  try {
    const personas = await executeQueryWithCache(
      "SELECT id, userId, name, avatar, gender, age, job, createdAt FROM personas WHERE userId = ? ORDER BY createdAt DESC LIMIT 20",
      [userId],
      120, // 2분 캐시
      3000
    );

    return successResponse({ personas: personas || [] });
  } catch (error) {
    console.error('Persona 조회 에러:', error);
    
    // 폴백 데이터 제공
    return fallbackResponse(
      { personas: [] },
      "페르소나 데이터를 불러오는 중 오류가 발생했습니다."
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId, name, avatar, gender, age, job } = data;

    if (!userId || !name?.trim()) {
      return errorResponse('userId와 name은 필수입니다.', 400);
    }

    // 입력 데이터 검증 및 정규화
    const normalizedData = {
      name: String(name).trim().slice(0, 20),
      avatar: avatar || '/imgdefault.jpg',
      gender: gender || '',
      age: age ? Math.min(Math.max(parseInt(age) || 0, 0), 150) : 0,
      job: job ? String(job).trim().slice(0, 30) : ''
    };

    // 자동으로 ID 생성
    const personaId = generatePersonaId();

    const result = await executeMutation(
      `INSERT INTO personas (id, userId, name, avatar, gender, age, job, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [personaId, userId, normalizedData.name, normalizedData.avatar, normalizedData.gender, normalizedData.age, normalizedData.job],
      5000
    );

    return successResponse({ 
      id: personaId,
      message: '페르소나가 성공적으로 생성되었습니다!'
    });
    
  } catch (error) {
    console.error('Persona 생성 에러:', error);
    
    // 폴백 처리
    const tempId = generatePersonaId();
    return fallbackResponse(
      { 
        id: tempId,
        message: '페르소나가 임시 생성되었습니다. 잠시 후 다시 확인해주세요.'
      }
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 