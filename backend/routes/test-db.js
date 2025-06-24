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