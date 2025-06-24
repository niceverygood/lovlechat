const express = require('express');
const router = express.Router();
const db = require('../services/db');
const cache = require('../services/cache');

// 채팅방 통합 정보 조회 API
router.get('/:characterId', async (req, res) => {
  const startTime = Date.now();
  const { characterId } = req.params;
  const { personaId, userId } = req.query;

  if (!characterId || !personaId) {
    return res.status(400).json({
      ok: false,
      error: 'characterId와 personaId가 필요합니다.'
    });
  }

  try {
    const cacheKey = `chatroom:${characterId}:${personaId}:${userId || 'guest'}`;
    
    // 캐시 확인
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`✅ 채팅방 정보 캐시 히트: ${cacheKey}`);
      return res.json({
        ok: true,
        cached: true,
        ...cachedData,
        responseTime: Date.now() - startTime
      });
    }

    // 병렬로 모든 필요한 데이터 조회
    const [
      characterResult,
      personaResult,
      messagesResult,
      firstDateResult,
      heartsResult
    ] = await Promise.all([
      // 1. 캐릭터 정보
      db.query('SELECT * FROM characters WHERE id = ?', [characterId]),
      
      // 2. 페르소나 정보 (게스트가 아닌 경우에만)
      personaId !== 'guest' 
        ? db.query('SELECT * FROM personas WHERE id = ?', [personaId])
        : Promise.resolve([null]),
      
      // 3. 최근 메시지 (20개)
      db.query(`
        SELECT c.*, ch.name as characterName, ch.profileImg as characterProfileImg, 
               ch.age as characterAge, ch.job as characterJob, p.avatar
        FROM chats c
        LEFT JOIN characters ch ON c.characterId = ch.id
        LEFT JOIN personas p ON c.personaId = p.id
        WHERE c.characterId = ? AND c.personaId = ?
        ORDER BY c.createdAt DESC
        LIMIT 20
      `, [characterId, personaId]),
      
      // 4. 첫 만남 날짜
      db.query(`
        SELECT MIN(createdAt) as firstDate 
        FROM chats 
        WHERE characterId = ? AND personaId = ?
      `, [characterId, personaId]),
      
      // 5. 하트 잔액 (userId가 있는 경우에만)
      userId 
        ? db.query('SELECT hearts FROM users WHERE uid = ?', [userId])
        : Promise.resolve([{ hearts: 0 }])
    ]);

    // 결과 검증
    if (!characterResult || characterResult.length === 0) {
      return res.status(404).json({
        ok: false,
        error: '캐릭터를 찾을 수 없습니다.'
      });
    }

    const character = characterResult[0];
    const persona = personaId === 'guest' 
      ? { name: '게스트', avatar: '/default_profile.png' }
      : (personaResult && personaResult.length > 0 ? personaResult[0] : null);
    
    // 메시지 역순 정렬 (오래된 것부터)
    const messages = messagesResult.reverse().map(msg => ({
      id: msg.id?.toString(),
      text: msg.message || '',
      message: msg.message || '',
      sender: msg.sender === 'assistant' ? 'ai' : msg.sender,
      timestamp: msg.createdAt,
      characterName: msg.characterName,
      characterProfileImg: msg.characterProfileImg,
      characterAge: msg.characterAge,
      characterJob: msg.characterJob,
      avatar: msg.avatar
    }));

    // 첫 만남 날짜에서 경과 일수 계산
    let daysSince = 1;
    if (firstDateResult && firstDateResult.length > 0 && firstDateResult[0].firstDate) {
      const firstDate = new Date(firstDateResult[0].firstDate);
      const now = new Date();
      daysSince = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // 호감도 조회 (캐릭터에 설정된 호감도)
    let favor = 0;
    try {
      const favorResult = await db.query(`
        SELECT favor FROM chats 
        WHERE characterId = ? AND personaId = ? 
        ORDER BY createdAt DESC 
        LIMIT 1
      `, [characterId, personaId]);
      
      if (favorResult && favorResult.length > 0) {
        favor = favorResult[0].favor || 0;
      }
    } catch (favorError) {
      console.error('호감도 조회 오류:', favorError);
    }

    const result = {
      character: {
        id: character.id,
        name: character.name,
        profileImg: character.profileImg,
        backgroundImg: character.backgroundImg,
        age: character.age,
        job: character.job,
        info: character.info,
        habit: character.habit,
        firstScene: character.firstScene,
        firstMessage: character.firstMessage
      },
      persona: persona ? {
        id: persona.id || 'guest',
        name: persona.name,
        avatar: persona.avatar || '/default_profile.png',
        gender: persona.gender,
        age: persona.age,
        job: persona.job,
        info: persona.info,
        habit: persona.habit
      } : null,
      messages,
      days: daysSince,
      favor,
      hearts: heartsResult && heartsResult.length > 0 ? heartsResult[0].hearts : 0,
      backgroundImageUrl: character.backgroundImg,
      messageCount: messages.length,
      hasMoreMessages: messages.length === 20
    };

    // 캐시 저장 (3분)
    await cache.set(cacheKey, result, 180);

    res.json({
      ok: true,
      cached: false,
      ...result,
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('채팅방 정보 조회 오류:', error);
    res.status(500).json({
      ok: false,
      error: '채팅방 정보를 불러오는데 실패했습니다.',
      details: error.message
    });
  }
});

// 채팅방 캐시 무효화
router.delete('/cache/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { personaId, userId } = req.query;
    
    const cacheKey = `chatroom:${characterId}:${personaId}:${userId || 'guest'}`;
    await cache.del(cacheKey);
    
    res.json({
      ok: true,
      message: '채팅방 캐시가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('캐시 삭제 오류:', error);
    res.status(500).json({
      ok: false,
      error: '캐시 삭제에 실패했습니다.'
    });
  }
});

module.exports = router; 