import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db-helper";

export async function GET(req: NextRequest) {
  try {
    // 간단한 DB 연결 테스트
    const rows = await executeQuery("SELECT 1 as test", [], 5000);
    
    if (rows && rows.length > 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "DB 연결 성공!", 
        data: rows[0] 
      });
    } else {
      return NextResponse.json({ 
        ok: false, 
        message: "DB 응답이 비어있습니다." 
      });
    }
  } catch (error) {
    return NextResponse.json({ 
      ok: false, 
      message: "DB 연결 실패", 
      error: String(error) 
    });
  }
} 