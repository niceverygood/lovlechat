const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Routes
app.use('/api/character', require('./routes/character'));
app.use('/api/character', require('./routes/character-id'));
app.use('/api/character/favor', require('./routes/character-favor'));
app.use('/api/character/refresh', require('./routes/character-refresh'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/persona', require('./routes/persona'));
app.use('/api/persona', require('./routes/persona-id'));
app.use('/api/hearts', require('./routes/hearts'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/test-db', require('./routes/test-db'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

app.listen(PORT, () => {
  console.log(`🚀 LovleChat Express Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 