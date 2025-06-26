const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');

// GET /api/test-db - 데이터베이스 연결 테스트
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT 1 as test');
    res.json({ 
      ok: true, 
      message: 'Database connection successful',
      result 
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Database connection failed',
      details: error.message 
    });
  }
});

// GET /api/test-db/env - 환경변수 확인 (개발/디버깅용)
router.get('/env', async (req, res) => {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      DB_HOST: process.env.DB_HOST ? process.env.DB_HOST.substring(0, 20) + '...' : 'Not set',
      DB_PORT: process.env.DB_PORT || 'Not set',
      DB_USER: process.env.DB_USER || 'Not set',
      DB_NAME: process.env.DB_NAME || 'Not set',
      DB_PASSWORD: process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : 'Not set',
      FRONTEND_URL: process.env.FRONTEND_URL || 'Not set',
      PORT: process.env.PORT || 'Not set',
      timestamp: new Date().toISOString()
    };
    
    res.json({ 
      ok: true, 
      message: 'Environment variables info',
      env: envInfo
    });
  } catch (error) {
    console.error('Environment check error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to check environment',
      details: error.message 
    });
  }
});

// GET /api/test-db/users - 사용자 목록 조회
router.get('/users', async (req, res) => {
  try {
    const users = await executeQuery('SELECT * FROM users LIMIT 10');
    res.json({ ok: true, users });
  } catch (error) {
    console.error('Users query error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// POST /api/test-db/query - 커스텀 쿼리 실행
router.post('/query', async (req, res) => {
  try {
    const { query, params = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Query is required' 
      });
    }

    let result;
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      result = await executeQuery(query, params);
    } else {
      result = await executeMutation(query, params);
    }

    res.json({ ok: true, result });
  } catch (error) {
    console.error('Custom query error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Query execution failed',
      details: error.message 
    });
  }
});

module.exports = router; 