import { NextResponse } from 'next/server';

// 허용된 오리진 목록
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'https://lovlechat.vercel.app',
  'https://lovlechat-frontend.vercel.app',
  'https://lovlechat-backend.vercel.app'
];

// 기본 CORS 헤더
export const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

/**
 * Origin 검증 및 적절한 CORS 헤더 반환
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let allowOrigin = '*';
  
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin) || isDevelopment) {
      allowOrigin = origin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    ...DEFAULT_CORS_HEADERS
  };
}

/**
 * CORS 헤더와 함께 JSON 응답 생성
 */
export function corsResponse(
  data: any, 
  options: { 
    status?: number; 
    origin?: string | null;
    headers?: Record<string, string>;
  } = {}
) {
  const { status = 200, origin, headers = {} } = options;
  
  return NextResponse.json(data, {
    status,
    headers: {
      ...getCorsHeaders(origin),
      ...headers
    }
  });
}

/**
 * OPTIONS 요청 처리 (프리플라이트)
 */
export function handleOptions(origin?: string | null) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin)
  });
}

/**
 * 에러 응답에 CORS 헤더 추가
 */
export function corsErrorResponse(
  error: string, 
  status: number = 500, 
  origin?: string | null
) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: getCorsHeaders(origin)
    }
  );
}

/**
 * 성공 응답에 CORS 헤더 추가
 */
export function corsSuccessResponse(
  data: any, 
  origin?: string | null,
  additionalHeaders?: Record<string, string>
) {
  return NextResponse.json(
    { ok: true, ...data },
    {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        ...additionalHeaders
      }
    }
  );
} 