import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    PORT: '3002'
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // CORS 및 보안 헤더 설정
  async headers() {
    return [
      {
        // API 경로에 대한 CORS 헤더
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'https://lovlechat.vercel.app'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ]
      }
    ];
  },

  // 개발 환경 최적화
  experimental: {
    turbo: {
      rules: {
        // TypeScript 컴파일 최적화
        '*.ts': ['typescript'],
        '*.tsx': ['typescript']
      }
    }
  },

  // 성능 최적화
  compress: true,
  poweredByHeader: false,
  
  // 개발 서버 설정
  serverRuntimeConfig: {
    port: process.env.PORT || 3002
  },
  
  // 공개 런타임 설정
  publicRuntimeConfig: {
    apiUrl: process.env.API_URL || 'http://localhost:3002'
  }
};

export default nextConfig;
