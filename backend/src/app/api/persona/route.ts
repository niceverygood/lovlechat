import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/persona?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400 });
  try {
    // 기본 프로필 존재 여부 확인
    const [existRows] = await pool.query(
      "SELECT * FROM user_personas WHERE userId = ? AND name = ?",
      [userId, userId]
    );
    if (!Array.isArray(existRows) || existRows.length === 0) {
      // 기본 프로필 자동 생성
      await pool.query(
        `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit) VALUES (?, ?, ?, '', '', '', '', '')`,
        [userId, userId, '/avatars/user.jpg']
      );
    }
    // 전체 목록 반환
    const [rows] = await pool.query(
      "SELECT * FROM user_personas WHERE userId = ? ORDER BY createdAt DESC",
      [userId]
    );
    return NextResponse.json({ ok: true, personas: rows });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/persona
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { userId, name, avatar, gender, age, job, info, habit } = data;
  if (!userId || !name) return NextResponse.json({ ok: false, error: 'userId, name required' }, { status: 400 });
  try {
    const [result]: any = await pool.query(
      `INSERT INTO user_personas (userId, name, avatar, gender, age, job, info, habit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, avatar, gender, age, job, info, habit]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
} 