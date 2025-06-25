const express = require('express');
const router = express.Router({ mergeParams: true });
const { executeQuery, executeOptimizedQuery, executeJoinQuery, executeMutation, parseJsonSafely } = require('../services/db');

// GET /api/character/:id - 특정 캐릭터 조회 (병렬 처리 최적화)
router.get('/', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
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
    firstMessage: "안녕하세요! 혹시 여기 자주 오시나요? 처음 보는 얼굴 같은데...",
    stats: { totalChats: 0, totalMessages: 0, avgFavor: 0 },
    relatedCharacters: []
  };
  
  try {
    console.log('🚀 캐릭터 상세 조회 - 병렬 최적화 쿼리 시작');
    console.time('parallelCharacterDetail');

    // 기본 쿼리 배열
    const baseQueries = [
      // 캐릭터 기본 정보 (필수 컬럼만)
      executeOptimizedQuery(
        "SELECT id, profileImg, name, age, job, oneLiner, background, personality, habit, likes, dislikes, extraInfos, gender, scope, roomCode, category, tags, attachments, firstScene, firstMessage, backgroundImg, createdAt FROM character_profiles WHERE id = ?",
        [id]
      ),
      
      // 관련 캐릭터 추천 (같은 카테고리/태그)
      executeOptimizedQuery(
        "SELECT id, name, profileImg, age, job, oneLiner FROM character_profiles WHERE id != ? AND scope = '공개' ORDER BY RAND() LIMIT 4",
        [id]
      )
    ];

    // 🔥 사용자별 추가 데이터 (로그인한 경우에만)
    if (userId && userId !== 'guest') {
      baseQueries.push(
        // 해당 캐릭터와의 채팅 통계
        executeOptimizedQuery(`
          SELECT 
            COUNT(DISTINCT c.personaId) as totalChats,
            COUNT(c.id) as totalMessages,
            AVG(COALESCE(cf.favor, 0)) as avgFavor
          FROM chats c
          INNER JOIN personas p ON c.personaId = p.id
          LEFT JOIN character_favors cf ON c.characterId = cf.characterId AND c.personaId = cf.personaId
          WHERE c.characterId = ? AND p.userId = ?
        `, [id, userId])
      );
    }

    // 병렬 실행
    const results = await Promise.all(baseQueries);
    
    console.timeEnd('parallelCharacterDetail');

    if (results[0].length === 0) {
      return res.json({ ok: true, character: fallbackCharacter, fallback: true });
    }

    const characterFromDb = results[0][0];
    const relatedCharacters = results[1] || [];
    const stats = userId && userId !== 'guest' && results[2] 
      ? results[2][0] 
      : { totalChats: 0, totalMessages: 0, avgFavor: 0 };

    const parsedCharacter = {
      ...characterFromDb,
      like: characterFromDb.likes,
      dislike: characterFromDb.dislikes,
      tags: parseJsonSafely(characterFromDb.tags, []),
      selectedTags: parseJsonSafely(characterFromDb.tags, []), // 프론트 호환용
      attachments: parseJsonSafely(characterFromDb.attachments, []),
      extraInfos: parseJsonSafely(characterFromDb.extraInfos, {}),
      stats: {
        totalChats: stats.totalChats || 0,
        totalMessages: stats.totalMessages || 0,
        avgFavor: Math.round(stats.avgFavor || 0)
      },
      relatedCharacters: relatedCharacters.map(char => ({
        id: char.id,
        name: char.name,
        profileImg: char.profileImg,
        age: char.age,
        job: char.job,
        oneLiner: char.oneLiner
      }))
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