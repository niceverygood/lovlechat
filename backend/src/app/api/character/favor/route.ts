import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";

/**
 * Character Favor API - User의 캐릭터 좋아요 관리
 * 
 * 개념 정리:
 * - User: 구글 로그인한 실제 사용자 1명 (Firebase Auth uid)
 * - 이 API는 User 레벨의 Character 좋아요를 관리
 * - character_favors 테이블에서 personaId가 userId(Firebase uid)인 레코드를 조회/관리
 */

// GET /api/character/favor?userId=xxx (User의 좋아요한 캐릭터 목록 조회)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'userId is required' },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }

  try {
    // User가 좋아요한 캐릭터 상세 정보 조회 (character_favors와 character_profiles 조인)
    const rows = await executeQuery(
      `SELECT 
         cf.characterId,
         cp.id,
         cp.profileImg,
         cp.name,
         cp.age,
         cp.job,
         cp.oneLiner,
         cp.tags,
         cp.attachments,
         cp.likes,
         cp.dislikes,
         cp.firstScene,
         cp.firstMessage,
         cp.backgroundImg,
         cp.createdAt
       FROM character_favors cf
       JOIN character_profiles cp ON cf.characterId = cp.id
       WHERE cf.personaId = ?
       ORDER BY cp.createdAt DESC`,
      [userId],
      3000
    );
    
    const liked = Array.isArray(rows) ? rows.map((row: any) => parseInt(row.characterId)) : [];
    const characters = Array.isArray(rows) ? rows : [];
    
    return NextResponse.json(
      { ok: true, liked, characters },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err) {
    console.error("DB error:", err);
    
    // DB 에러시 빈 배열 반환
    return NextResponse.json(
      { ok: true, liked: [], fallback: true },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// POST /api/character/favor (User가 캐릭터에 좋아요 추가)
export async function POST(req: NextRequest) {
  try {
    const { userId, characterId } = await req.json();
    
    if (!userId || !characterId) {
      return NextResponse.json(
        { ok: false, error: 'userId and characterId are required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // 좋아요 추가 (이미 있으면 무시)
    await executeMutation(
      "INSERT IGNORE INTO character_favors (personaId, characterId, favor) VALUES (?, ?, 1)",
      [userId, characterId],
      3000
    );
    
    return NextResponse.json(
      { ok: true, message: 'Character liked successfully' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err) {
    console.error("Favor POST error:", err);
    
    return NextResponse.json(
      { ok: false, error: 'Failed to add like' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// DELETE /api/character/favor (User가 캐릭터 좋아요 제거)
export async function DELETE(req: NextRequest) {
  try {
    const { userId, characterId } = await req.json();
    
    if (!userId || !characterId) {
      return NextResponse.json(
        { ok: false, error: 'userId and characterId are required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // 좋아요 제거
    await executeMutation(
      "DELETE FROM character_favors WHERE personaId = ? AND characterId = ?",
      [userId, characterId],
      3000
    );
    
    return NextResponse.json(
      { ok: true, message: 'Character unliked successfully' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err) {
    console.error("Favor DELETE error:", err);
    
    return NextResponse.json(
      { ok: false, error: 'Failed to remove like' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
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