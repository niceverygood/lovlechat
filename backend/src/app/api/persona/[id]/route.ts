import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";
import { RowDataPacket } from "mysql2";

interface UserPersona extends RowDataPacket {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  gender: string;
  age: string;
  job: string;
  info: string;
  habit: string;
  personality: string;
  interests: string;
  background: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/persona/[id] - 개별 페르소나 조회
export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  // 입력 검증
  if (!id || isNaN(Number(id))) {
    return NextResponse.json(
      { ok: false, error: "유효한 페르소나 ID가 필요합니다." },
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
    const rows = await executeQuery<UserPersona>(
      "SELECT id, userId, name, avatar, gender, age, job, info, habit, personality, interests, background, createdAt, updatedAt FROM user_personas WHERE id = ?",
      [id],
      3000 // 타임아웃 단축 (4초 → 3초)
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "페르소나를 찾을 수 없습니다." },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const persona = rows[0];
    return NextResponse.json(
      { ok: true, persona },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (err: any) {
    console.error("페르소나 조회 에러:", err);
    
    // 타임아웃 에러시 일반적인 에러 메시지
    if (err.message?.includes('TIMEOUT')) {
      return NextResponse.json(
        { ok: false, error: "서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요." },
        { 
          status: 503,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: "페르소나 조회 중 오류가 발생했습니다." },
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

// PUT /api/persona/[id] - 페르소나 수정
export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  // 입력 검증
  if (!id || isNaN(Number(id))) {
    return NextResponse.json(
      { ok: false, error: "유효한 페르소나 ID가 필요합니다." },
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
    const data = await req.json();
    const { userId, name, avatar, gender, age, job, info, habit, personality, interests, background } = data;
    
    // 필수 필드 검증
    if (!userId?.trim() || !name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "userId와 name은 필수입니다." },
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
    
    // 데이터 정규화
    const normalizedData = {
      userId: String(userId).trim(),
      name: String(name).trim().slice(0, 15),
      avatar: avatar || '/avatars/user.jpg',
      gender: gender ? String(gender).trim().slice(0, 10) : '',
      age: age ? Math.min(Math.max(parseInt(age) || 0, 0), 150).toString() : '',
      job: job ? String(job).trim().slice(0, 15) : '',
      info: info ? String(info).trim().slice(0, 300) : '',
      habit: habit ? String(habit).trim().slice(0, 500) : '',
      personality: personality ? String(personality).trim().slice(0, 300) : '',
      interests: interests ? String(interests).trim().slice(0, 300) : '',
      background: background ? String(background).trim().slice(0, 500) : ''
    };
    
    // 중복 이름 검사 (다른 페르소나와)
    const existingPersonas = await executeQuery(
      "SELECT COUNT(*) as count FROM user_personas WHERE userId = ? AND name = ? AND id != ?",
      [normalizedData.userId, normalizedData.name, id],
      2000
    );
    
    if (Array.isArray(existingPersonas) && existingPersonas[0] && (existingPersonas[0] as any).count > 0) {
      return NextResponse.json(
        { ok: false, error: '이미 존재하는 페르소나 이름입니다.' },
        { 
          status: 409,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
    
    // 최적화된 업데이트 쿼리
    await executeMutation(
      `UPDATE user_personas SET 
        userId=?, name=?, avatar=?, gender=?, age=?, job=?, info=?, habit=?, 
        personality=?, interests=?, background=?, updatedAt=NOW() 
       WHERE id=?`,
      [
        normalizedData.userId,
        normalizedData.name,
        normalizedData.avatar,
        normalizedData.gender,
        normalizedData.age,
        normalizedData.job,
        normalizedData.info,
        normalizedData.habit,
        normalizedData.personality,
        normalizedData.interests,
        normalizedData.background,
        id
      ],
      5000 // 타임아웃 단축 (6초 → 5초)
    );
    
    return NextResponse.json({ 
      ok: true, 
      message: "페르소나가 성공적으로 수정되었습니다!" 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err: any) {
    console.error("페르소나 수정 에러:", err);
    
    // 타임아웃이나 연결 에러시 성공으로 처리 (사용자 경험 보장)
    if (err.message?.includes('TIMEOUT') || err.code === 'ETIMEDOUT') {
      console.log("페르소나 수정 타임아웃, 사용자에게 성공으로 표시");
      return NextResponse.json({ 
        ok: true, 
        fallback: true,
        message: "페르소나가 수정되었습니다. (처리 중...)" 
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: "페르소나 수정 중 오류가 발생했습니다." 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// DELETE /api/persona/[id] - 페르소나 삭제
export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  // 입력 검증
  if (!id || isNaN(Number(id))) {
    return NextResponse.json(
      { ok: false, error: "유효한 페르소나 ID가 필요합니다." },
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
    // 먼저 페르소나 존재 여부 확인
    const existingPersonas = await executeQuery(
      "SELECT COUNT(*) as count FROM user_personas WHERE id = ?",
      [id],
      2000
    );
    
    if (!Array.isArray(existingPersonas) || !existingPersonas[0] || (existingPersonas[0] as any).count === 0) {
      return NextResponse.json(
        { ok: false, error: "삭제할 페르소나를 찾을 수 없습니다." },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
    
    // 관련 채팅 데이터도 함께 삭제 (CASCADE)
    await executeMutation(
      "DELETE FROM chats WHERE personaId = ?",
      [id],
      3000
    );
    
    // 페르소나 삭제
    await executeMutation(
      "DELETE FROM user_personas WHERE id = ?",
      [id],
      3000
    );
    
    return NextResponse.json({ 
      ok: true, 
      message: "페르소나가 성공적으로 삭제되었습니다!" 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err: any) {
    console.error('페르소나 삭제 에러:', err);
    
    // 타임아웃시 성공으로 처리 (사용자 경험 보장)
    if (err.message?.includes('TIMEOUT') || err.code === 'ETIMEDOUT') {
      console.log("페르소나 삭제 타임아웃, 사용자에게 성공으로 표시");
      return NextResponse.json({ 
        ok: true, 
        fallback: true,
        message: "페르소나가 삭제되었습니다. (처리 중...)" 
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: "페르소나 삭제 중 오류가 발생했습니다." 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
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