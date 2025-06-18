import { NextRequest, NextResponse } from "next/server";
import { executeQuery, executeMutation } from "@/lib/db-helper";
import { RowDataPacket } from "mysql2";

interface UserPersona extends RowDataPacket {
  id: string;
  name: string;
  personality: string;
  interests: string;
  background: string;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  try {
    const rows = await executeQuery(
      "SELECT * FROM user_personas WHERE id = ?",
      [id],
      4000
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Persona not found" },
        { status: 404,
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
  } catch (err) {
    console.error("DB error:", err);
    
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params;
  
  try {
    await executeMutation(
      "DELETE FROM user_personas WHERE id = ?",
      [id],
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
    console.error("Database error:", err);
    
    return NextResponse.json({ ok: false, error: "Database error" }, {
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

export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params;
  const data = await req.json();
  const { userId, name, avatar, gender, age, job, info, habit, personality, interests, background } = data;
  
  try {
    await executeMutation(
      `UPDATE user_personas SET userId=?, name=?, avatar=?, gender=?, age=?, job=?, info=?, habit=?, personality=?, interests=?, background=? WHERE id=?`,
      [userId, name, avatar, gender, age, job, info, habit, personality, interests, background, id],
      6000
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
    
    return NextResponse.json({ ok: false, error: "Database error" }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
} 