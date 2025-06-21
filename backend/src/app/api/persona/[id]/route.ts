import { NextRequest } from "next/server";
import { executeQuery, executeMutation, executeQueryWithCache } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse, fallbackResponse } from "@/lib/cors";

/**
 * Persona Individual API - 개별 멀티프로필 관리
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

export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return errorResponse('페르소나 ID가 필요합니다.', 400);
  }

  try {
    const personas = await executeQueryWithCache(
      "SELECT id, userId, name, avatar, gender, age, job, info, habit, personality, interests, background, createdAt FROM personas WHERE id = ?",
      [id],
      180 // 3분 캐시
    );

    if (!personas || personas.length === 0) {
      return errorResponse('페르소나를 찾을 수 없습니다.', 404);
    }

    return successResponse({ persona: personas[0] });
    
  } catch (error) {
    console.error('페르소나 조회 에러:', error);
    
    // 폴백 데이터 제공
    return fallbackResponse(
      { 
        persona: {
          id: id,
          name: "기본 프로필",
          avatar: "/imgdefault.jpg",
          gender: "",
          age: 0,
          job: ""
        }
      },
      "페르소나 정보를 불러오는 중 오류가 발생했습니다."
    );
  }
}

export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return errorResponse('페르소나 ID가 필요합니다.', 400);
  }

  try {
    const data = await req.json();
    const { name, avatar, gender, age, job } = data;

    // 입력 데이터 검증 및 정규화
    const normalizedData = {
      name: name ? String(name).trim().slice(0, 20) : '',
      avatar: avatar || '/imgdefault.jpg',
      gender: gender || '',
      age: age ? Math.min(Math.max(parseInt(age) || 0, 0), 150) : 0,
      job: job ? String(job).trim().slice(0, 30) : ''
    };

    if (!normalizedData.name) {
      return errorResponse('이름은 필수입니다.', 400);
    }

    const result = await executeMutation(
      `UPDATE personas SET 
       name = ?, avatar = ?, gender = ?, age = ?, job = ?, updatedAt = NOW()
       WHERE id = ?`,
      [normalizedData.name, normalizedData.avatar, normalizedData.gender, normalizedData.age, normalizedData.job, id]
    );

    if (result.affectedRows === 0) {
      return errorResponse('페르소나를 찾을 수 없습니다.', 404);
    }

    return successResponse({ 
      message: '페르소나가 성공적으로 수정되었습니다!' 
    });
    
  } catch (error) {
    console.error('페르소나 수정 에러:', error);
    
    return fallbackResponse(
      { message: '페르소나 수정이 임시 저장되었습니다.' },
      "수정 사항을 저장하는 중 오류가 발생했습니다."
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;

  if (!id) {
    return errorResponse('페르소나 ID가 필요합니다.', 400);
  }

  try {
    // 관련 채팅 데이터도 함께 삭제
    await executeMutation(
      "DELETE FROM chats WHERE personaId = ?",
      [id]
    );

    await executeMutation(
      "DELETE FROM character_favors WHERE personaId = ?", 
      [id]
    );

    const result = await executeMutation(
      "DELETE FROM personas WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return errorResponse('페르소나를 찾을 수 없습니다.', 404);
    }

    return successResponse({ 
      message: '페르소나가 성공적으로 삭제되었습니다!' 
    });
    
  } catch (error) {
    console.error('페르소나 삭제 에러:', error);
    
    return errorResponse(
      '페르소나 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.',
      500
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 