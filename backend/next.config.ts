import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    PORT: '3002'
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 빌드 성능 최적화
  experimental: {
    // 빌드 성능 향상
    optimizePackageImports: ['react-icons'],
  },
  // 웹팩 최적화
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 프로덕션 빌드 최적화
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
