import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const data = await req.json();
  // profileImg는 base64 string일 수 있음
  const {
    userId, profileImg, name, age, job, oneLiner, background, personality, habit, like, dislike,
    extraInfos, gender, scope, roomCode, category, selectedTags, attachments, firstScene, firstMessage, backgroundImg
  } = data;
  try {
    const [result]: any = await pool.query(
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
        JSON.stringify(extraInfos),
        gender,
        scope,
        roomCode,
        category,
        JSON.stringify(selectedTags),
        JSON.stringify(attachments),
        firstScene,
        firstMessage,
        backgroundImg
      ]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    } });
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
      // 연결 테스트 (빠른 실패를 위해 타임아웃 단축)
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
      ]);
      
      const result = await Promise.race([
        pool.query(
          `SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg 
           FROM character_profiles 
           WHERE userId = ? AND id NOT IN (SELECT characterId FROM character_hidden WHERE userId = ?)
           ORDER BY createdAt DESC LIMIT 10`,
          [userId, userId]
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000))
      ]);
      
      const [rows] = result as any;
      
      return NextResponse.json({ ok: true, characters: rows }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } catch (err) {
      console.error("Database error:", err);
      
      // DB 에러시 폴백 데이터 반환
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
    // 연결 테스트
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    
    const result = await Promise.race([
      pool.query(
        "SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg FROM character_profiles ORDER BY createdAt DESC LIMIT 20"
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
    ]);
    
    const [rows] = result as any;
    
    return NextResponse.json({ ok: true, characters: rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    
    // DB 에러시 폴백 데이터 반환
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