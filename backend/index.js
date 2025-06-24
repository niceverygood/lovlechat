const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { cacheService } = require('./services/cache');
const { router: monitoringRouter, monitoringMiddleware } = require('./routes/monitoring');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Vercel/AWS Load Balancer
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// 개발 환경에서 모든 origin 허용 (테스트 목적)
if (process.env.NODE_ENV !== 'production') {
  app.options('*', cors());
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 모니터링 미들웨어 (모든 API 요청 추적)
app.use('/api', monitoringMiddleware);

// Routes
app.use('/api/character', require('./routes/character'));
app.use('/api/character', require('./routes/character-id'));
app.use('/api/character/favor', require('./routes/character-favor'));
app.use('/api/character/refresh', require('./routes/character-refresh'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/chat-data', require('./routes/chat-data'));
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