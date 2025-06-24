const express = require('express');
const router = express.Router({ mergeParams: true });
const { executeQuery, executeMutation, parseJsonSafely } = require('../services/db');

// GET /api/character/:id - 특정 캐릭터 조회
router.get('/', async (req, res) => {
  const { id } = req.params;
  
  const fallbackCharacter = {
    id: id,
    name: "캐릭터 " + id,
    age: "20",
    job: "학생",
    oneLiner: "안녕하세요!",
    background: "기본 배경",
    personality: "친근함",
    selectedTags: ["친근한", "밝은"],
    profileImg: "/imgdefault.jpg",
    backgroundImg: "/imgdefault.jpg",
    firstScene: "조용한 카페에서 우연히 마주친 두 사람. 따뜻한 햇살이 창문으로 스며들고, 커피 향이 은은하게 퍼져있다.",
    firstMessage: "안녕하세요! 혹시 여기 자주 오시나요? 처음 보는 얼굴 같은데..."
  };
  
  try {
    const results = await executeQuery(
      "SELECT id, profileImg, name, age, job, oneLiner, background, personality, habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, firstScene, firstMessage, backgroundImg, createdAt, updatedAt FROM character_profiles WHERE id = ?",
      [id]
    );

    if (results.length === 0) {
      return res.json({ ok: true, character: fallbackCharacter });
    }

    const characterFromDb = results[0];
    const parsedCharacter = {
      ...characterFromDb,
      like: characterFromDb.likes,
      dislike: characterFromDb.dislikes,
      tags: parseJsonSafely(characterFromDb.tags, []),
      selectedTags: parseJsonSafely(characterFromDb.tags, []), // 프론트 호환용
      attachments: parseJsonSafely(characterFromDb.attachments, []),
      extraInfos: parseJsonSafely(characterFromDb.extraInfos, {}),
    };

    res.json({ ok: true, character: parsedCharacter });

  } catch (error) {
    console.error("DB error:", error);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.message === 'TIMEOUT') {
      console.log("DB connection failed, returning fallback data for character:", id);
      return res.json({ ok: true, character: fallbackCharacter, fallback: true });
    }
    
    res.status(500).json({ ok: false, error: error.toString() });
  }
});

// PUT /api/character/:id - 캐릭터 수정
router.put('/', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const {
    profileImg, name, age, job, oneLiner, background, personality, habit, like, dislike,
    extraInfos, gender, scope, roomCode, category, selectedTags, attachments, firstScene, firstMessage, backgroundImg
  } = data;
  
  try {
    await executeMutation(
      `UPDATE character_profiles SET
        profileImg = ?, name = ?, age = ?, job = ?, oneLiner = ?, background = ?, 
        personality = ?, habit = ?, likes = ?, dislikes = ?, extraInfos = ?, gender = ?, 
        scope = ?, roomCode = ?, category = ?, tags = ?, attachments = ?, 
        firstScene = ?, firstMessage = ?, backgroundImg = ?
      WHERE id = ?`,
      [
        profileImg, name, age, job, oneLiner, background, personality, habit,
        like, // 'like'는 DB의 'likes' 컬럼에 매핑
        dislike, // 'dislike'는 DB의 'dislikes' 컬럼에 매핑
        JSON.stringify(extraInfos || {}),
        gender, scope, roomCode, category,
        JSON.stringify(selectedTags || []), // 'selectedTags'는 DB의 'tags' 컬럼에 매핑
        JSON.stringify(attachments || []),
        firstScene, firstMessage, backgroundImg,
        id
      ]
    );
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Database error:", error);
    
    if (error.code === 'ETIMEDOUT' || error.message === 'TIMEOUT') {
      console.log("DB update timeout, but returning success to user");
      return res.json({ ok: true, fallback: true });
    }
    
    res.status(500).json({ ok: false, error: error.toString() });
  }
});

// DELETE /api/character/:id - 캐릭터 숨기기
router.delete('/', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId required' });
  }
  
  try {
    await executeMutation(
      'INSERT IGNORE INTO character_hidden (userId, characterId) VALUES (?, ?)',
      [userId, id]
    );
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Database error:', error);
    
    if (error.code === 'ETIMEDOUT' || error.message === 'TIMEOUT') {
      return res.json({ ok: true, fallback: true });
    }
    
    res.status(500).json({ ok: false, error: error.toString() });
  }
});

module.exports = router; 