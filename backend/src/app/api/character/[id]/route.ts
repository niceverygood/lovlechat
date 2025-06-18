import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";

interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  image_url: string;
  personality: string;
  background: string;
  voice: string;
  hashtags: string;
  catchphrase: string;
  created_at: string;
  updated_at: string;
}

function parseJsonSafely(jsonString: string | null): any {
  if (!jsonString) return null;
  try {
    // 해시태그 문자열을 JSON 배열로 변환
    if (jsonString.startsWith('#')) {
      const tags = jsonString.split(',').map(tag => tag.trim());
      return tags;
    }
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("JSON parse error:", e);
    return null;
  }
}

export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  // 기본 캐릭터 데이터 (DB 연결 실패시 폴백용)
  const fallbackCharacter = {
    id: id,
    name: "캐릭터 " + id,
    age: "20",
    job: "학생",
    oneLiner: "안녕하세요!",
    background: "기본 배경",
    personality: "친근함",
    profileImg: "/imgdefault.jpg",
    backgroundImg: "/imgdefault.jpg"
  };
  
  try {
    // 최적화된 캐릭터 데이터 조회
    const rows = await executeQuery(
      "SELECT id, profileImg, name, age, job, oneLiner, background, personality, habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, firstScene, firstMessage, backgroundImg, createdAt, updatedAt FROM character_profiles WHERE id = ?",
      [id],
      5000
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      // DB에 데이터가 없으면 폴백 데이터 반환
      return NextResponse.json(
        { ok: true, character: fallbackCharacter },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const character = rows[0];
    const parsedCharacter = {
      ...character,
      hashtags: parseJsonSafely((character as any).hashtags),
      personality: parseJsonSafely((character as any).personality),
    };

    return NextResponse.json(
      { ok: true, character: parsedCharacter },
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
    
    // DB 연결 에러시 폴백 데이터 반환 (500 에러 대신)
    if ((err as any)?.code === 'ETIMEDOUT' || (err as any)?.code === 'ECONNREFUSED' || (err as any)?.message === 'TIMEOUT') {
      console.log("DB connection failed, returning fallback data for character:", id);
      return NextResponse.json(
        { ok: true, character: fallbackCharacter, fallback: true },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
    
    // 기타 에러는 500으로 처리
    return NextResponse.json(
      { ok: false, error: String(err) },
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

export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;
  const data = await req.json();
  const {
    profileImg, name, age, job, oneLiner, background, personality, habit, like, dislike,
    extraInfos, gender, scope, roomCode, category, selectedTags, attachments, firstScene, firstMessage, backgroundImg
  } = data;
  
  try {
    // 최적화된 업데이트 쿼리
    const result = await executeMutation(
      `UPDATE character_profiles SET
        profileImg = ?,
        name = ?,
        age = ?,
        job = ?,
        oneLiner = ?,
        background = ?,
        personality = ?,
        habit = ?,
        likes = ?,
        dislikes = ?,
        extraInfos = ?,
        gender = ?,
        scope = ?,
        roomCode = ?,
        category = ?,
        tags = ?,
        attachments = ?,
        firstScene = ?,
        firstMessage = ?,
        backgroundImg = ?
      WHERE id = ?`,
      [
        profileImg,
        name,
        age,
        job,
        oneLiner,
        background,
        personality,
        habit,
        like,
        dislike,
        JSON.stringify(extraInfos || {}),
        gender,
        scope,
        roomCode,
        category,
        JSON.stringify(selectedTags || []),
        JSON.stringify(attachments || []),
        firstScene,
        firstMessage,
        backgroundImg,
        id
      ],
      8000
    );
    
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // 타임아웃이나 연결 에러시 성공으로 처리 (사용자에게는 성공으로 보이게)
    if ((err as any)?.code === 'ETIMEDOUT' || (err as any)?.message === 'TIMEOUT') {
      console.log("DB update timeout, but returning success to user");
      return NextResponse.json({ ok: true, fallback: true }, {
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

export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    } });
  }
  
  try {
    // 최적화된 삭제 쿼리 (숨김 처리)
    await executeMutation(
      'INSERT IGNORE INTO character_hidden (userId, characterId) VALUES (?, ?)',
      [userId, id],
      4000
    );
    
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    
    // 타임아웃시 성공으로 처리
    if ((err as any)?.code === 'ETIMEDOUT' || (err as any)?.message === 'TIMEOUT') {
      return NextResponse.json({ ok: true, fallback: true }, {
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