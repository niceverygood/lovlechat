const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');
const { createChatCompletion, isOpenAIAvailable, generateFallbackResponse, generateImmersivePrompt } = require('../services/openai');
const { processFavorChange, getFavor, filterFavorKeywords } = require('../services/favorCalculator');

// 하트 사용 함수
async function useHearts(userId, amount = 1, description = '채팅', relatedId = '') {
  try {
    // 현재 잔액 조회
    const balanceResult = await executeQuery(
      'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const currentBalance = balanceResult.length > 0 ? balanceResult[0].afterHearts : 100;
    
    // 하트가 부족한 경우
    if (currentBalance < amount) {
      return { success: false, error: '하트가 부족합니다.', currentHearts: currentBalance };
    }

    // 하트 차감
    const newBalance = Math.max(0, currentBalance - amount);
    
    const result = await executeMutation(
      `INSERT INTO heart_transactions (userId, amount, type, description, relatedId, beforeHearts, afterHearts, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, -Math.abs(amount), 'chat', description, relatedId, currentBalance, newBalance]
    );

    if (result.affectedRows > 0) {
      return { success: true, newHearts: newBalance, beforeHearts: currentBalance };
    } else {
      return { success: false, error: '하트 차감 실패' };
    }
  } catch (error) {
    console.error('하트 사용 에러:', error);
    return { success: false, error: error.message };
  }
}

// POST /api/chat - 새로운 메시지 전송
router.post('/', async (req, res) => {
  console.time('postChat');
  try {
    const { personaId, characterId, message, userId } = req.body;

    if (!personaId || !characterId || !message) {
      return res.status(400).json({ 
        ok: false, 
        error: "personaId, characterId, and message are required" 
      });
    }

    // 로그인하지 않은 사용자는 채팅 불가
    if (!userId || userId === 'guest') {
      return res.status(401).json({ ok: false, error: '로그인 후 이용해 주세요.' });
    }

    // 게스트 모드 처리
    if (personaId === 'guest') {
      const fallbackResponse = generateFallbackResponse('AI', '', message);
      return res.json({ 
        ok: true, 
        response: fallbackResponse,
        messages: [],
        favor: 0,
        favorChange: 0
      });
    }

    // 하트 사용 (로그인한 사용자만)
    if (userId && userId !== 'guest') {
      const heartResult = await useHearts(userId, 1, '채팅', `${personaId}_${characterId}`);
      
      if (!heartResult.success) {
        return res.status(400).json({
          ok: false,
          error: heartResult.error,
          currentHearts: heartResult.currentHearts
        });
      }
    }

    // 캐릭터 정보 조회
    console.time('getCharacter');
    const characters = await executeQuery(
      "SELECT * FROM character_profiles WHERE id = ?",
      [characterId]
    );
    console.timeEnd('getCharacter');
    if (characters.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "Character not found" 
      });
    }
    const character = characters[0];

    // 페르소나 정보 조회
    const personas = await executeQuery(
      "SELECT * FROM personas WHERE id = ?",
      [personaId]
    );
    const persona = personas[0] || {};

    // 최근 대화내역 조회 (최신 20개, 오래된 순) - 필요한 컬럼만 선택
    console.time('getChatHistory');
    const chatRows = await executeQuery(
      "SELECT id, sender, message, createdAt FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt DESC LIMIT 20",
      [personaId, characterId]
    );
    console.timeEnd('getChatHistory');
    const chatHistory = chatRows.reverse();

    // 몰입형 system prompt 생성
    const systemPrompt = generateImmersivePrompt(character, persona, chatHistory);

    // messages 배열 생성 (system + 최근 대화 + 이번 입력)
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map(row => ({
        role: row.sender === 'user' ? 'user' : 'assistant',
        content: row.message
      })),
      { role: "user", content: message }
    ];

    // 호감도 관련 키워드 필터링 (DB 저장용)
    const filteredMessage = filterFavorKeywords(message);

    // 1. 사용자 메시지 저장 (필터링된 메시지)
    await executeMutation(
      "INSERT INTO chats (personaId, characterId, message, sender, createdAt) VALUES (?, ?, ?, 'user', NOW())",
      [personaId, characterId, filteredMessage]
    );

    // 2. 호감도 처리 (원본 메시지 기반)
    const favorResult = await processFavorChange(personaId, characterId, message);

    // 3. AI 응답 생성
    console.time('generateAIResponse');
    let aiResponse;
    if (isOpenAIAvailable()) {
      try {
        aiResponse = await createChatCompletion(messages, {
          model: "gpt-4o-mini",
          max_tokens: 150,
          temperature: 0.9
        });
      } catch (error) {
        console.error('AI 응답 생성 실패:', error);
        aiResponse = generateFallbackResponse(character.name, '', message);
      }
    } else {
      aiResponse = generateFallbackResponse(character.name, '', message);
    }
    console.timeEnd('generateAIResponse');
    
    // AI 응답에서도 호감도 관련 키워드 필터링
    const filteredAiResponse = filterFavorKeywords(aiResponse);
    
    // 4. AI 응답 저장 (필터링된 응답)
    await executeMutation(
      "INSERT INTO chats (personaId, characterId, message, sender, createdAt) VALUES (?, ?, ?, 'ai', NOW())",
      [personaId, characterId, filteredAiResponse]
    );
    
    // 5. 업데이트된 메시지 목록 조회 - 필요한 컬럼만 선택하고 페이징 적용
    console.time('getUpdatedMessages');
    const updatedMessages = await executeQuery(
      "SELECT id, sender, message, createdAt FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT 50",
      [personaId, characterId]
    );
    console.timeEnd('getUpdatedMessages');
    
    res.json({ 
      ok: true, 
      response: aiResponse,
      messages: updatedMessages,
      favor: favorResult.currentFavor,
      favorChange: favorResult.favorChange,
      previousFavor: favorResult.previousFavor || 0
    });
    console.timeEnd('postChat');

  } catch (error) {
    console.error("POST /chat error:", error);
    console.timeEnd('postChat');
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/chat - 채팅 히스토리 조회 (페이징 지원)
router.get('/', async (req, res) => {
  console.time('getChat');
  const { personaId, characterId, page = 1, limit = 50 } = req.query;

  if (!personaId || !characterId) {
    return res.status(400).json({ 
      ok: false, 
      error: "personaId and characterId are required" 
    });
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 100); // 최대 100개로 제한
  const offset = (pageNum - 1) * limitNum;

  try {
    // 게스트 모드 처리
    if (personaId === 'guest') {
      return res.json({ ok: true, messages: [], favor: 0 });
    }
    
    // 메시지 조회
    console.time('getMessages');
    
    // 개발 환경에서만 성능 분석
    if (process.env.NODE_ENV === 'development') {
      const explainMessages = await executeQuery(
        "EXPLAIN SELECT id, sender, message, createdAt FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT ? OFFSET ?",
        [personaId, characterId, limitNum, offset]
      );
    }
    
    const messages = await executeQuery(
      "SELECT id, sender, message, createdAt FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT ? OFFSET ?",
      [personaId, characterId, limitNum, offset]
    );
    console.timeEnd('getMessages');
    
    // 전체 메시지 개수 조회 (페이징 정보용)
    const totalCountResult = await executeQuery(
      "SELECT COUNT(*) as total FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId]
    );
    const totalMessages = totalCountResult[0].total;
    
    // 현재 호감도 조회
    const currentFavor = await getFavor(personaId, characterId);
    
    res.json({ 
      ok: true, 
      messages, 
      favor: currentFavor,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalMessages / limitNum),
        totalMessages,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < totalMessages,
        hasPrevPage: pageNum > 1
      }
    });
    console.timeEnd('getChat');
    
  } catch (error) {
    console.error("GET /chat error:", error);
    console.timeEnd('getChat');
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/chat/list - 채팅 목록 조회 (새로 추가)
router.get('/list', async (req, res) => {
  console.time('getChatList');
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: "userId is required" 
    });
  }

  try {
    // 사용자의 채팅 목록을 조회 (최신 메시지와 함께)
    console.time('getChatListQuery');
    
    // 성능 분석을 위한 EXPLAIN 쿼리 (JOIN 최적화 버전)
    const explainResult = await executeQuery(`
      EXPLAIN SELECT 
        c.characterId,
        c.personaId,
        cp.name,
        cp.profileImg,
        p.name as personaName,
        p.avatar as personaAvatar,
        cm.message as lastMessage,
        c.lastChatTime
      FROM (
        SELECT 
          characterId,
          personaId,
          MAX(createdAt) as lastChatTime
        FROM chats
        GROUP BY characterId, personaId
      ) c
      LEFT JOIN character_profiles cp ON c.characterId = cp.id
      LEFT JOIN personas p ON c.personaId = p.id
      LEFT JOIN chats cm ON c.characterId = cm.characterId 
                         AND c.personaId = cm.personaId 
                         AND c.lastChatTime = cm.createdAt
      WHERE p.userId = ?
      ORDER BY c.lastChatTime DESC
      LIMIT 20
    `, [userId]);
    console.log('🔍 Chat List Query EXPLAIN:', JSON.stringify(explainResult, null, 2));
    
    // N+1 쿼리 문제 해결: 서브쿼리를 JOIN으로 최적화
    const chats = await executeQuery(`
      SELECT 
        c.characterId,
        c.personaId,
        cp.name,
        cp.profileImg,
        p.name as personaName,
        p.avatar as personaAvatar,
        cm.message as lastMessage,
        c.lastChatTime
      FROM (
        SELECT 
          characterId,
          personaId,
          MAX(createdAt) as lastChatTime
        FROM chats
        GROUP BY characterId, personaId
      ) c
      LEFT JOIN character_profiles cp ON c.characterId = cp.id
      LEFT JOIN personas p ON c.personaId = p.id
      LEFT JOIN chats cm ON c.characterId = cm.characterId 
                         AND c.personaId = cm.personaId 
                         AND c.lastChatTime = cm.createdAt
      WHERE p.userId = ?
      ORDER BY c.lastChatTime DESC
      LIMIT 20
    `, [userId]);
    console.timeEnd('getChatListQuery');
    
    res.json({ ok: true, chats });
    console.timeEnd('getChatList');
  } catch (error) {
    console.error('Chat list 조회 에러:', error);
    console.timeEnd('getChatList');
    res.status(500).json({ 
      ok: false, 
      error: '채팅 목록을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// GET /api/chat/dummy - 게스트용 더미 채팅 목록 (새로 추가)
router.get('/dummy', async (req, res) => {
  const { count = 5 } = req.query;
  
  try {
    // 공개 캐릭터들로 더미 채팅 목록 생성
    const characters = await executeQuery(`
      SELECT id, name, profileImg, age, job, oneLiner
      FROM character_profiles 
      WHERE scope = '공개' 
      ORDER BY RAND() 
      LIMIT ?
    `, [parseInt(count)]);
    
    const dummyChats = characters.map((char, index) => ({
      characterId: char.id,
      personaId: 'guest',
      name: char.name,
      profileImg: char.profileImg,
      personaName: '게스트',
      personaAvatar: '/default_profile.png',
      lastMessage: char.oneLiner || '안녕하세요!',
      lastChatTime: new Date()
    }));
    
    res.json({ ok: true, chats: dummyChats });
  } catch (error) {
    console.error('Dummy chat 생성 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '더미 채팅 목록 생성 실패',
      details: error.message 
    });
  }
});

// GET /api/chat/first-date - 첫 데이트 조회 (새로 추가)
router.get('/first-date', async (req, res) => {
  const { personaId, characterId } = req.query;
  
  if (!personaId || !characterId) {
    return res.status(400).json({ 
      ok: false, 
      error: "personaId and characterId are required" 
    });
  }

  try {
    const result = await executeQuery(`
      SELECT MIN(createdAt) as firstDate 
      FROM chats 
      WHERE personaId = ? AND characterId = ?
    `, [personaId, characterId]);
    
    const firstDate = result[0]?.firstDate;
    res.json({ ok: true, firstDate });
  } catch (error) {
    console.error('First date 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '첫 데이트 정보를 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// POST /api/chat/generate-background - 배경 이미지 생성 (새로 추가)
router.post('/generate-background', async (req, res) => {
  const { characterId, scene } = req.body;
  
  if (!characterId || !scene) {
    return res.status(400).json({ 
      ok: false, 
      error: "characterId and scene are required" 
    });
  }

  try {
    // 임시로 더미 배경 이미지 URL 반환
    const backgroundImageUrl = `https://via.placeholder.com/400x600/FFB3D1/FFFFFF?text=${encodeURIComponent(scene)}`;
    
    res.json({ 
      ok: true, 
      backgroundImageUrl,
      message: '배경 이미지가 생성되었습니다.' 
    });
  } catch (error) {
    console.error('Background generation 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '배경 이미지 생성 실패',
      details: error.message 
    });
  }
});

// DELETE /api/chat - 채팅 삭제
router.delete('/', async (req, res) => {
  try {
    const { personaId, characterId } = req.body;
    
    if (!personaId || !characterId) {
      return res.status(400).json({ 
        ok: false, 
        error: "페르소나 ID와 캐릭터 ID는 필수입니다." 
      });
    }

    const result = await executeMutation(
      "DELETE FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId]
    );
    
    res.json({
      ok: true,
      message: `대화 내용이 삭제되었습니다. (삭제된 대화 수: ${result.affectedRows})`,
    });
  } catch (error) {
    console.error("대화 삭제 오류:", error);
    res.status(500).json({ 
      ok: false, 
      error: "대화 내용 삭제 중 오류가 발생했습니다.",
      details: error.message 
    });
  }
});

module.exports = router; 