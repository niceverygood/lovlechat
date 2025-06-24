const express = require('express');
const router = express.Router();
const { executeQueryWithCache, executeQuery, executeMutation } = require('../services/db');

// POST /api/character/refresh - 캐릭터 목록 새로고침 (하트 50개 소모)
router.post('/', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    // 현재 하트 잔액 확인
    const heartsResult = await executeQuery(
      'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const currentHearts = heartsResult.length > 0 ? heartsResult[0].afterHearts : 100;
    const requiredHearts = 50;

    if (currentHearts < requiredHearts) {
      return res.status(400).json({
        ok: false,
        error: '하트가 부족합니다.',
        currentHearts,
        requiredHearts
      });
    }

    // 하트 차감 기록
    const newBalance = currentHearts - requiredHearts;
    await executeMutation(
      `INSERT INTO heart_transactions (userId, amount, type, description, beforeHearts, afterHearts, createdAt) 
       VALUES (?, ?, 'use', '캐릭터 새로 받기', ?, ?, NOW())`,
      [userId, requiredHearts, currentHearts, newBalance]
    );

    // 새로운 캐릭터 5장 조회 (랜덤)
    const newCharacters = await executeQueryWithCache(
      `SELECT id, profileImg, name, age, job, oneLiner, category, tags, attachments, likes, dislikes, firstScene, firstMessage, backgroundImg 
       FROM character_profiles 
       WHERE scope = '공개' 
       ORDER BY RAND() 
       LIMIT 5`,
      [],
      null, // 캐시 키 없음 (항상 새로 조회)
      0     // TTL 0 (캐시 안함)
    );

    res.json({ 
      ok: true, 
      characters: newCharacters || [], 
      type: 'refresh_characters',
      heartsUsed: requiredHearts,
      remainingHearts: newBalance,
      message: `하트 ${requiredHearts}개를 사용하여 새로운 캐릭터 ${newCharacters.length}장을 받았습니다!`
    });
    
  } catch (error) {
    console.error('Character refresh 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: "캐릭터 새로고침 중 오류가 발생했습니다.",
      details: error.message 
    });
  }
});

// GET /api/character/refresh - 새로고침 가능 여부 확인
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    // 현재 하트 잔액 확인
    const heartsResult = await executeQuery(
      'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const currentHearts = heartsResult.length > 0 ? heartsResult[0].afterHearts : 100;
    const requiredHearts = 50;
    const canRefresh = currentHearts >= requiredHearts;

    res.json({ 
      ok: true, 
      canRefresh,
      currentHearts,
      requiredHearts,
      message: canRefresh ? '새로고침 가능합니다.' : '하트가 부족합니다.'
    });
    
  } catch (error) {
    console.error('Character refresh 체크 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: "새로고침 가능 여부 확인 중 오류가 발생했습니다.",
      details: error.message 
    });
  }
});

module.exports = router; 