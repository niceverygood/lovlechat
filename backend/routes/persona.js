const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');
const { v4: uuidv4 } = require('uuid');

// GET /api/persona - 페르소나 목록 조회 (최적화됨)
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    const personas = await executeQuery(
      'SELECT id, name, avatar, gender, age, job, info, habit, createdAt FROM personas WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );

    res.json({ 
      ok: true, 
      personas: personas.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        gender: p.gender,
        age: p.age,
        job: p.job,
        info: p.info,
        habit: p.habit,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: '페르소나 데이터를 불러올 수 없습니다.'
    });
  }
});

// POST /api/persona - 페르소나 생성
router.post('/', async (req, res) => {
  try {
    const { userId, name, age, gender, job, info, habit, avatar } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId와 name은 필수입니다.' 
      });
    }

    const personaId = uuidv4();
    
    const result = await executeMutation(
      `INSERT INTO personas (id, userId, name, age, gender, job, info, habit, avatar, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        personaId,
        userId || '', 
        name || '', 
        age || null, 
        gender || '', 
        job || '', 
        info || '', 
        habit || '', 
        avatar || null
      ]
    );

    if (result.affectedRows > 0) {
      res.json({ 
        ok: true, 
        persona: { id: personaId, userId, name, age, gender, job, info, habit, avatar }
      });
    } else {
      res.status(500).json({ ok: false, error: '페르소나 생성 실패' });
    }
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: '페르소나 생성 중 오류가 발생했습니다.'
    });
  }
});

// Persona ID별 라우트
router.use('/:id', require('./persona-id'));

module.exports = router; 