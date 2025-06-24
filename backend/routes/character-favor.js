const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');

// GET /api/character/favor - 사용자의 캐릭터 좋아요 목록 조회
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    // 좋아요한 캐릭터 ID 목록 조회
    const favoriteIds = await executeQuery(
      'SELECT characterId FROM character_favors WHERE userId = ?',
      [userId]
    );

    const liked = favoriteIds.map(f => f.characterId);

    // 좋아요한 캐릭터 상세 정보 조회
    const characters = favoriteIds.length > 0 ? await executeQuery(
      `SELECT id, name, profileImg, age, job, oneLiner, category, tags, backgroundImg
       FROM character_profiles 
       WHERE id IN (${favoriteIds.map(() => '?').join(',')})
       ORDER BY FIELD(id, ${favoriteIds.map(() => '?').join(',')})`,
      [...favoriteIds.map(f => f.characterId), ...favoriteIds.map(f => f.characterId)]
    ) : [];

    res.json({ 
      ok: true, 
      liked,
      characters,
      count: liked.length
    });
  } catch (error) {
    console.error('Character favor 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '좋아요 목록을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// POST /api/character/favor - 캐릭터 좋아요 추가
router.post('/', async (req, res) => {
  try {
    const { userId, characterId } = req.body;

    if (!userId || !characterId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId와 characterId는 필수입니다.' 
      });
    }

    // 이미 좋아요한 캐릭터인지 확인
    const existing = await executeQuery(
      'SELECT id FROM character_favors WHERE userId = ? AND characterId = ?',
      [userId, characterId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        ok: false,
        error: '이미 좋아요한 캐릭터입니다.'
      });
    }

    // 좋아요 추가
    const result = await executeMutation(
      'INSERT INTO character_favors (userId, characterId, favor, createdAt) VALUES (?, ?, 1, NOW())',
      [userId, characterId]
    );

    if (result.affectedRows > 0) {
      res.json({ 
        ok: true, 
        favorited: true,
        message: '좋아요가 추가되었습니다.'
      });
    } else {
      res.status(500).json({ ok: false, error: '좋아요 추가 실패' });
    }
  } catch (error) {
    console.error('Character favor 추가 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '좋아요 추가 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// DELETE /api/character/favor - 캐릭터 좋아요 제거
router.delete('/', async (req, res) => {
  try {
    const { userId, characterId } = req.body;

    if (!userId || !characterId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId와 characterId는 필수입니다.' 
      });
    }

    // 좋아요 제거
    const result = await executeMutation(
      'DELETE FROM character_favors WHERE userId = ? AND characterId = ?',
      [userId, characterId]
    );

    if (result.affectedRows > 0) {
      res.json({ 
        ok: true, 
        favorited: false,
        message: '좋아요가 취소되었습니다.'
      });
    } else {
      res.status(404).json({ 
        ok: false, 
        error: '좋아요 정보를 찾을 수 없습니다.' 
      });
    }
  } catch (error) {
    console.error('Character favor 제거 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '좋아요 제거 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/character/favor/check - 특정 캐릭터 좋아요 상태 확인 (새로 추가)
router.get('/check', async (req, res) => {
  const { userId, characterId } = req.query;
  
  if (!userId || !characterId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId and characterId are required' 
    });
  }

  try {
    const existing = await executeQuery(
      'SELECT id FROM character_favors WHERE userId = ? AND characterId = ?',
      [userId, characterId]
    );

    res.json({ 
      ok: true, 
      favorited: existing.length > 0
    });
  } catch (error) {
    console.error('Character favor 확인 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '좋아요 상태 확인 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router; 