import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

// Railway DB 연결 설정
const railwayConfig = {
  host: "caboose.proxy.rlwy.net",
  port: 27568,
  user: "root",
  password: "PVXEJHnkfSEBLVcrZEHacIjHaTwWnOQr",
  database: "railway",
  connectTimeout: 60000,
  acquireTimeout: 60000,
};

export async function GET(req: NextRequest) {
  let connection;
  
  try {
    // Railway DB 연결
    connection = await mysql.createConnection(railwayConfig);
    
    const backup: any = {};

    // 1. character_profiles 백업
    try {
      const [profiles] = await connection.query("SELECT * FROM character_profiles");
      backup.character_profiles = profiles;
      console.log(`Character profiles backed up: ${(profiles as any[]).length} rows`);
    } catch (error) {
      console.log("character_profiles 테이블이 존재하지 않거나 오류:", error);
      backup.character_profiles = [];
    }

    // 2. chats 백업
    try {
      const [chats] = await connection.query("SELECT * FROM chats");
      backup.chats = chats;
      console.log(`Chats backed up: ${(chats as any[]).length} rows`);
    } catch (error) {
      console.log("chats 테이블이 존재하지 않거나 오류:", error);
      backup.chats = [];
    }

    // 3. character_favors 백업
    try {
      const [favors] = await connection.query("SELECT * FROM character_favors");
      backup.character_favors = favors;
      console.log(`Character favors backed up: ${(favors as any[]).length} rows`);
    } catch (error) {
      console.log("character_favors 테이블이 존재하지 않거나 오류:", error);
      backup.character_favors = [];
    }

    // 4. character_hidden 백업
    try {
      const [hidden] = await connection.query("SELECT * FROM character_hidden");
      backup.character_hidden = hidden;
      console.log(`Character hidden backed up: ${(hidden as any[]).length} rows`);
    } catch (error) {
      console.log("character_hidden 테이블이 존재하지 않거나 오류:", error);
      backup.character_hidden = [];
    }

    // 5. personas 백업
    try {
      const [personas] = await connection.query("SELECT * FROM personas");
      backup.personas = personas;
      console.log(`Personas backed up: ${(personas as any[]).length} rows`);
    } catch (error) {
      console.log("personas 테이블이 존재하지 않거나 오류:", error);
      backup.personas = [];
    }

    // 6. first_dates 백업
    try {
      const [firstDates] = await connection.query("SELECT * FROM first_dates");
      backup.first_dates = firstDates;
      console.log(`First dates backed up: ${(firstDates as any[]).length} rows`);
    } catch (error) {
      console.log("first_dates 테이블이 존재하지 않거나 오류:", error);
      backup.first_dates = [];
    }

    backup.backup_timestamp = new Date().toISOString();
    
    return NextResponse.json({ 
      ok: true, 
      message: "Railway DB 백업 완료",
      backup: backup
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: String(error) 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 