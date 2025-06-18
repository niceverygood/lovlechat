import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface UserPersona extends RowDataPacket {
  id: string;
  name: string;
  profile_image: string;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest, context: any) {
  const { id } = context.params;
  
  try {
    const [rows] = await pool.query<UserPersona[]>(
      "SELECT * FROM user_personas WHERE id = ?",
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Persona not found" },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
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
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
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
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const { id } = context.params;
  try {
    await pool.query("DELETE FROM user_personas WHERE id = ?", [id]);
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: {
      'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    } });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function PUT(req: NextRequest, context: any) {
  const { id } = context.params;
  const data = await req.json();
  let { name, avatar, gender, age, job, info, habit } = data;
  // age를 숫자 또는 null로 변환
  age = age && !isNaN(Number(age)) ? Number(age) : null;
  try {
    await pool.query(
      `UPDATE user_personas SET name=?, avatar=?, gender=?, age=?, job=?, info=?, habit=? WHERE id=?`,
      [name, avatar, gender, age, job, info, habit, id]
    );
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: {
      'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    } });
  }
} 