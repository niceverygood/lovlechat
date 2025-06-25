const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { cacheService } = require('./services/cache');
const { router: monitoringRouter, monitoringMiddleware } = require('./routes/monitoring');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Vercel/AWS Load Balancer
app.set('trust proxy', 1);

// 성능 최적화 미들웨어
// gzip 압축 활성화
app.use(compression({
  filter: (req, res) => {
    // 압축하지 않을 요청 타입 필터링
    if (req.headers['x-no-compression']) {
      return false;
    }
    // 기본 compression 필터 사용
    return compression.filter(req, res);
  },
  level: 6, // 압축 레벨 (1-9, 6이 기본값)
  threshold: 1024, // 1KB 이상일 때만 압축
  memLevel: 8 // 메모리 사용량 (1-9)
}));

// Keep-Alive 설정
app.use((req, res, next) => {
  // Keep-Alive 헤더 설정
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=30, max=1000');
  
  // 캐시 관련 헤더 최적화
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // CORS preflight 캐싱
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간
  }
  
  next();
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Vercel 환경 호환성
  contentSecurityPolicy: false // 개발 편의성
}));

// CORS 설정 최적화
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200, // IE11 호환성
  maxAge: 86400 // preflight 캐시 24시간
}));

// 개발 환경에서 모든 origin 허용 (테스트 목적)
if (process.env.NODE_ENV !== 'production') {
  app.options('*', cors());
}

// Rate limiting 최적화
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 개발 환경에서는 더 관대하게
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 재시도 권장 시간(초)
  },
  standardHeaders: true, // `RateLimit-*` 헤더 추가
  legacyHeaders: false, // `X-RateLimit-*` 헤더 비활성화
  skip: (req) => {
    // 헬스체크와 모니터링은 rate limit 제외
    return req.url === '/health' || req.url === '/api/health' || req.url.startsWith('/api/monitoring');
  }
});
app.use(limiter);

// Body parsing middleware 최적화
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain'] // JSON과 텍스트만 파싱
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000 // 파라미터 개수 제한
}));

// 응답 시간 측정 미들웨어
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📊 ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    
    // 성능 헤더 추가
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  next();
});

// 모니터링 미들웨어 (모든 API 요청 추적)
app.use('/api', monitoringMiddleware);

// Routes
app.use('/api/character', require('./routes/character'));
app.use('/api/character', require('./routes/character-id'));
app.use('/api/character/favor', require('./routes/character-favor'));
app.use('/api/character/refresh', require('./routes/character-refresh'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/chat-data', require('./routes/chat-data'));
app.use('/api/chatroom', require('./routes/chatroom'));
app.use('/api/persona', require('./routes/persona'));
app.use('/api/persona', require('./routes/persona-id'));
app.use('/api/hearts', require('./routes/hearts'));
app.use('/api/myinfo', require('./routes/myinfo'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/deploy', require('./routes/deploy'));
app.use('/api/test-db', require('./routes/test-db'));
app.use('/api/monitoring', monitoringRouter);

// Health check
app.get('/health', async (req, res) => {
  const cache = await cacheService.healthCheck();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cache 
  });
});

app.get('/api/health', async (req, res) => {
  const cache = await cacheService.healthCheck();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cache 
  });
});

// 캐시 상태 및 통계
app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({ ok: true, stats });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'API is running',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// 정적 파일 서빙 (React build)
app.use(express.static(path.join(__dirname, '../frontend/build')));

// SPA 라우팅 지원: /api로 시작하지 않는 모든 요청은 React index.html 반환
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Redis 초기화
const initializeCache = async () => {
  try {
    await cacheService.connect();
  } catch (error) {
    console.error('캐시 초기화 실패:', error);
  }
};

// 서버 시작
const startServer = async () => {
  await initializeCache();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 LovleChat Express Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // 서버 종료 시 Redis 연결 정리
  const gracefulShutdown = async () => {
    console.log('\n⚠️ 서버 종료 신호 받음. 정리 중...');
    
    try {
      await cacheService.disconnect();
      server.close(() => {
        console.log('✅ 서버 종료 완료');
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ 서버 종료 중 오류:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
};

startServer(); 