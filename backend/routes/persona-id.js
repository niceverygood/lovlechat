const express = require('express');
const router = express.Router({ mergeParams: true });
const { executeQuery, executeMutation } = require('../services/db');

// GET /api/persona/:id - 특정 페르소나 조회
router.get('/', async (req, res) => {
  const { id } = req.params;
  
  try {
    const results = await executeQuery(
      'SELECT * FROM personas WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: '페르소나를 찾을 수 없습니다.' 
      });
    }

    res.json({ ok: true, persona: results[0] });
  } catch (error) {
    console.error('Persona 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '페르소나 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// PUT /api/persona/:id - 페르소나 수정
router.put('/', async (req, res) => {
  const { id } = req.params;
  const { name, age, gender, job, info, habit, avatar } = req.body;
  
  try {
    const result = await executeMutation(
      `UPDATE personas SET 
        name = ?, age = ?, gender = ?, job = ?, info = ?, 
        habit = ?, avatar = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        name || '', 
        age || null, 
        gender || '', 
        job || '', 
        info || '', 
        habit || '', 
        avatar || null, 
        id
      ]
    );
    
    if (result.affectedRows > 0) {
      res.json({ ok: true, message: '페르소나가 수정되었습니다.' });
    } else {
      res.status(404).json({ ok: false, error: '페르소나를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Persona 수정 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '페르소나 수정 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// DELETE /api/persona/:id - 페르소나 삭제
router.delete('/', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await executeMutation(
      'DELETE FROM personas WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows > 0) {
      res.json({ ok: true, message: '페르소나가 삭제되었습니다.' });
    } else {
      res.status(404).json({ ok: false, error: '페르소나를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Persona 삭제 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '페르소나 삭제 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router; 