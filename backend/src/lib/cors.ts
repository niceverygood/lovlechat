import { NextResponse } from 'next/server';

// 공통 CORS 헤더 설정
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24시간 캐시
} as const;

// 성공 응답 헬퍼
export function successResponse(data: any, status: number = 200) {
  return NextResponse.json(
    { ok: true, ...data },
    { status, headers: CORS_HEADERS }
  );
}

// 에러 응답 헬퍼
export function errorResponse(error: string, status: number = 400, details?: any) {
  const response = { ok: false, error, ...(details && { details }) };
  return NextResponse.json(response, { status, headers: CORS_HEADERS });
}

// OPTIONS 요청 응답 헬퍼
export function optionsResponse() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

// 폴백 응답 헬퍼 (DB 연결 실패시)
export function fallbackResponse(data: any, message?: string) {
  return NextResponse.json(
    { 
      ok: true, 
      ...data, 
      fallback: true,
      ...(message && { message })
    },
    { headers: CORS_HEADERS }
  );
} 