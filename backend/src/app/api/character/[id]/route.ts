import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

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

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  
  try {
    const [rows] = await pool.query(
      "SELECT id, profileImg, name, age, job, oneLiner, background, personality, habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, firstScene, firstMessage, backgroundImg, createdAt, updatedAt FROM character_profiles WHERE id = ?",
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Character not found" },
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

    const character = rows[0];
    // 해시태그와 페르소나를 파싱
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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const data = await req.json();
  const {
    profileImg, name, age, job, oneLiner, background, personality, habit, like, dislike,
    extraInfos, gender, scope, roomCode, category, selectedTags, attachments, firstScene, firstMessage, backgroundImg
  } = data;
  try {
    const [result] = await pool.query(
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
        JSON.stringify(extraInfos),
        gender,
        scope,
        roomCode,
        category,
        JSON.stringify(selectedTags),
        JSON.stringify(attachments),
        firstScene,
        firstMessage,
        backgroundImg,
        id
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400 });
  }
  try {
    await pool.query(
      'INSERT IGNORE INTO character_hidden (userId, characterId) VALUES (?, ?)',
      [userId, id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
} 