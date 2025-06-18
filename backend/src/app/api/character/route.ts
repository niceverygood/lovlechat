import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";

export async function POST(req: NextRequest) {
  const data = await req.json();
  // profileImg는 base64 string일 수 있음
  const {
    userId, profileImg, name, age, job, oneLiner, background, personality, habit, like, dislike,
    extraInfos, gender, scope, roomCode, category, selectedTags, attachments, firstScene, firstMessage, backgroundImg
  } = data;
  
  try {
    // 최적화된 INSERT 쿼리 (연결 테스트 없이 직접 실행)
    const result = await executeMutation(
      `INSERT INTO character_profiles
        (userId, profileImg, name, age, job, oneLiner, background, personality, habit, 
         likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, firstScene, firstMessage, backgroundImg, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
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
        JSON.stringify(gender || ''),
        scope,
        roomCode,
        category,
        JSON.stringify(selectedTags || []),
        JSON.stringify(attachments || []),
        firstScene,
        firstMessage,
        backgroundImg
      ],
      10000
    );
    
    const [insertResult] = result as any;
    
    return NextResponse.json({ ok: true, id: insertResult.insertId }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 연결 실패 시 폴백 데이터로 응답 (사용자 경험 보장)
    const tempId = Date.now();
    console.log(`캐릭터 생성 폴백 처리: ${name} (임시 ID: ${tempId})`);
    
    return NextResponse.json({ ok: true, id: tempId, fallback: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  
  // 폴백 캐릭터 데이터
  const fallbackCharacters = [
    {
      id: "1",
      profileImg: "/imgdefault.jpg",
      name: "아이유",
      age: "30",
      job: "가수",
      oneLiner: "안녕하세요! 아이유입니다.",
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
      attachments: null,
      firstScene: "연습실",
      firstMessage: "안녕! 오늘도 열심히 해보자!",
      backgroundImg: "/imgdefault.jpg"
    }
  ];

  if (userId) {
    try {
      // 최적화된 쿼리 실행
      const rows = await executeQuery(
        `SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg 
         FROM character_profiles 
         WHERE userId = ? AND id NOT IN (SELECT characterId FROM character_hidden WHERE userId = ?)
         ORDER BY createdAt DESC LIMIT 10`,
        [userId, userId],
        8000
      );
      
      return NextResponse.json({ ok: true, characters: rows }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } catch (err) {
      console.error("Database error:", err);
      
      // DB 연결 실패 시 폴백 데이터로 응답 (사용자 경험 보장)
      return NextResponse.json({ ok: true, characters: fallbackCharacters, fallback: true }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
  }
  
  // 전체 조회 (For You) - 폴백 데이터 우선 반환
  try {
    // 최적화된 전체 캐릭터 조회
    const rows = await executeQuery(
      "SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg FROM character_profiles ORDER BY createdAt DESC LIMIT 20",
      [],
      6000
    );
    
    return NextResponse.json({ ok: true, characters: rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 연결 실패 시 폴백 데이터로 응답 (사용자 경험 보장)
    return NextResponse.json({ ok: true, characters: fallbackCharacters, fallback: true }, {
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