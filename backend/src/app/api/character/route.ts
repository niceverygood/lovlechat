import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

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
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (userId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg 
         FROM character_profiles 
         WHERE userId = ? AND id NOT IN (SELECT characterId FROM character_hidden WHERE userId = ?)
         ORDER BY createdAt DESC`,
        [userId, userId]
      );
      return NextResponse.json({ ok: true, characters: rows });
    } catch (err) {
      console.error("Database error:", err);
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }
  // 기존 전체 조회 (For You)
  try {
    const [rows] = await pool.query(
      "SELECT id, profileImg, name, age, job, oneLiner, attachments, firstScene, firstMessage, backgroundImg FROM character_profiles ORDER BY createdAt DESC"
    );
    return NextResponse.json({ ok: true, characters: rows });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
} 