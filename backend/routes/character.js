const express = require('express');
const router = express.Router();
const { executeQueryWithCache, executeMutation } = require('../services/db');

// 환경 설정
const MAX_USER_CHARACTERS = 10;
const MAX_PUBLIC_CHARACTERS = 5;

// GET /api/character - 캐릭터 목록 조회
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  try {
    if (userId) {
      const userCharacters = await executeQueryWithCache(
        `SELECT id, profileImg, name, age, job, oneLiner, category, tags, attachments, likes, dislikes, firstScene, firstMessage, backgroundImg 
         FROM character_profiles WHERE userId = ? ORDER BY createdAt DESC LIMIT ${MAX_USER_CHARACTERS}`,
        [userId],
        `user_characters_${userId}`,
        60000 // 1분 캐시
      );

      res.json({ ok: true, characters: userCharacters || [], type: 'user_characters' });
      
    } else {
      const publicCharacters = await executeQueryWithCache(
        `SELECT id, profileImg, name, age, job, oneLiner, tags, attachments, likes, dislikes, firstScene, firstMessage, backgroundImg 
         FROM character_profiles WHERE scope = '공개' ORDER BY RAND() LIMIT ${MAX_PUBLIC_CHARACTERS}`,
        [],
        'public_characters',
        300000 // 5분 캐시
      );

      res.json({ ok: true, characters: publicCharacters || [], type: 'public_characters' });
    }
    
  } catch (error) {
    console.error('Character 조회 에러:', error.message);
    res.status(500).json({ 
      ok: false, 
      error: "캐릭터 데이터를 불러올 수 없습니다.",
      details: error.message 
    });
  }
});

// POST /api/character - 캐릭터 생성
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.userId || !data.name?.trim()) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId와 name은 필수입니다.' 
      });
    }

    const result = await executeMutation(
      `INSERT INTO character_profiles (
        userId, name, age, job, profileImg, oneLiner, background, personality, 
        habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, 
        tags, attachments, firstScene, firstMessage, backgroundImg, 
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.userId || '', 
        data.name || '', 
        data.age || null, 
        data.job || '', 
        data.profileImg || null, 
        data.oneLiner || '', 
        data.background || '', 
        data.personality || '', 
        data.habit || '', 
        data.likes || '', 
        data.dislikes || '', 
        JSON.stringify(data.extraInfos || []), 
        data.gender || '설정하지 않음', 
        data.scope || '공개', 
        data.roomCode || '', 
        data.category || '', 
        JSON.stringify(data.tags || []), 
        JSON.stringify(data.attachments || []), 
        data.firstScene || '', 
        data.firstMessage || '', 
        data.backgroundImg || null
      ]
    );

    if (result.affectedRows > 0 && result.insertId) {
      const newCharacter = { id: result.insertId, ...data };
      res.json({ 
        ok: true, 
        id: result.insertId,
        character: newCharacter, 
        message: '캐릭터가 성공적으로 생성되었습니다!' 
      });
    } else {
      res.status(500).json({ ok: false, error: '캐릭터 생성 실패' });
    }
    
  } catch (error) {
    console.error('Character 생성 에러:', error.message);
    res.status(500).json({ 
      ok: false, 
      error: "캐릭터 생성 중 오류가 발생했습니다.",
      details: error.message 
    });
  }
});

// Character ID별 라우트
router.use('/:id', require('./character-id'));

// Character favor 라우트
router.use('/favor', require('./character-favor'));

// Character refresh 라우트
router.use('/refresh', require('./character-refresh'));

module.exports = router; 