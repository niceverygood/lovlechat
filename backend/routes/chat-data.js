const express = require('express');
const router = express.Router();
const { executeQuery } = require('../services/db');

// GET /api/chat-data/init - 채팅방 진입시 필요한 모든 데이터 통합 조회
router.get('/init', async (req, res) => {
  console.time('getChatInitData');
  const { personaId, characterId, userId, page = 1, limit = 20 } = req.query;

  if (!personaId || !characterId) {
    return res.status(400).json({ 
      ok: false, 
      error: "personaId and characterId are required" 
    });
  }

  try {
    // 게스트 모드 처리
    if (personaId === 'guest') {
      return res.json({ 
        ok: true, 
        character: null,
        persona: { name: "게스트", avatar: "/default_profile.png" },
        hearts: 0,
        messages: [],
        favor: 0,
        pagination: { totalMessages: 0, hasNextPage: false }
      });
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const offset = (pageNum - 1) * limitNum;

    console.time('unifiedQuery');
    
    // 통합 쿼리: 캐릭터, 페르소나, 하트, 메시지를 한 번에 조회
    const unifiedQuery = `
      SELECT 
        -- Character Data
        cp.id as character_id,
        cp.name as character_name,
        cp.profileImg as character_profile_img,
        cp.age as character_age,
        cp.job as character_job,
        cp.info as character_info,
        cp.habit as character_habit,
        cp.firstScene as character_first_scene,
        cp.firstMessage as character_first_message,
        
        -- Persona Data  
        p.id as persona_id,
        p.name as persona_name,
        p.avatar as persona_avatar,
        p.gender as persona_gender,
        p.age as persona_age,
        p.job as persona_job,
        p.info as persona_info,
        p.habit as persona_habit,
        p.userId as persona_user_id,
        
        -- Hearts Data (최신 하트 잔액)
        COALESCE(ht.afterHearts, 100) as current_hearts,
        
        -- Messages Count
        (SELECT COUNT(*) FROM chats WHERE personaId = ? AND characterId = ?) as total_messages,
        
        -- Current Favor
        COALESCE(cf.favor, 0) as current_favor
        
      FROM character_profiles cp
      CROSS JOIN personas p
      LEFT JOIN (
        SELECT userId, afterHearts, 
               ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
        FROM heart_transactions
      ) ht ON ht.userId = p.userId AND ht.rn = 1
      LEFT JOIN (
        SELECT personaId, characterId, favor,
               ROW_NUMBER() OVER (PARTITION BY personaId, characterId ORDER BY createdAt DESC) as rn
        FROM character_favors
      ) cf ON cf.personaId = p.id AND cf.characterId = cp.id AND cf.rn = 1
      WHERE cp.id = ? AND p.id = ?
    `;

    const [unifiedResult] = await executeQuery(unifiedQuery, [personaId, characterId, characterId, personaId]);
    
    if (!unifiedResult) {
      return res.status(404).json({
        ok: false,
        error: "Character or Persona not found"
      });
    }

    console.timeEnd('unifiedQuery');

    // 메시지 조회 (페이징 적용)
    console.time('getMessages');
    const messagesQuery = `
      SELECT id, sender, message, createdAt 
      FROM chats 
      WHERE personaId = ? AND characterId = ? 
      ORDER BY createdAt ASC 
      LIMIT ? OFFSET ?
    `;
    
    const messages = await executeQuery(messagesQuery, [personaId, characterId, limitNum, offset]);
    console.timeEnd('getMessages');

    // 응답 데이터 구성
    const character = {
      id: unifiedResult.character_id,
      name: unifiedResult.character_name,
      profileImg: unifiedResult.character_profile_img,
      age: unifiedResult.character_age,
      job: unifiedResult.character_job,
      info: unifiedResult.character_info,
      habit: unifiedResult.character_habit,
      firstScene: unifiedResult.character_first_scene,
      firstMessage: unifiedResult.character_first_message
    };

    const persona = {
      id: unifiedResult.persona_id,
      name: unifiedResult.persona_name,
      avatar: unifiedResult.persona_avatar,
      gender: unifiedResult.persona_gender,
      age: unifiedResult.persona_age,
      job: unifiedResult.persona_job,
      info: unifiedResult.persona_info,
      habit: unifiedResult.persona_habit,
      userId: unifiedResult.persona_user_id
    };

    const pagination = {
      currentPage: pageNum,
      totalPages: Math.ceil(unifiedResult.total_messages / limitNum),
      totalMessages: unifiedResult.total_messages,
      limit: limitNum,
      hasNextPage: pageNum * limitNum < unifiedResult.total_messages,
      hasPrevPage: pageNum > 1
    };

    res.json({
      ok: true,
      character,
      persona,
      hearts: unifiedResult.current_hearts,
      messages,
      favor: unifiedResult.current_favor,
      pagination
    });

    console.timeEnd('getChatInitData');

  } catch (error) {
    console.error("GET /chat-data/init error:", error);
    console.timeEnd('getChatInitData');
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/chat-data/list - 채팅 목록 조회 최적화 (하트 정보 포함)
router.get('/list', async (req, res) => {
  console.time('getChatListOptimized');
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: "userId is required" 
    });
  }

  try {
    console.time('getChatListQuery');
    
    // 최적화된 통합 쿼리: 채팅 목록 + 하트 정보 한 번에 조회
    const optimizedQuery = `
      SELECT 
        c.characterId,
        c.personaId,
        c.lastChatTime,
        
        -- Character Info
        cp.name as character_name,
        cp.profileImg as character_profile_img,
        
        -- Persona Info  
        p.name as persona_name,
        p.avatar as persona_avatar,
        
        -- Last Message
        cm.message as last_message,
        cm.sender as last_sender,
        
        -- Hearts (최신 하트 잔액)
        COALESCE(ht.afterHearts, 100) as current_hearts,
        
        -- Message Count
        c.message_count
        
      FROM (
        SELECT 
          characterId,
          personaId,
          MAX(createdAt) as lastChatTime,
          COUNT(*) as message_count
        FROM chats
        GROUP BY characterId, personaId
      ) c
      LEFT JOIN character_profiles cp ON c.characterId = cp.id
      LEFT JOIN personas p ON c.personaId = p.id
      LEFT JOIN chats cm ON c.characterId = cm.characterId 
                         AND c.personaId = cm.personaId 
                         AND c.lastChatTime = cm.createdAt
      LEFT JOIN (
        SELECT userId, afterHearts,
               ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
        FROM heart_transactions
      ) ht ON ht.userId = p.userId AND ht.rn = 1
      WHERE p.userId = ?
      ORDER BY c.lastChatTime DESC
      LIMIT 20
    `;
    
    const chats = await executeQuery(optimizedQuery, [userId]);
    console.timeEnd('getChatListQuery');
    
    // 하트 정보도 포함된 응답
    const response = {
      ok: true, 
      chats: chats.map(chat => ({
        characterId: chat.characterId,
        personaId: chat.personaId,
        name: chat.character_name,
        profileImg: chat.character_profile_img,
        personaName: chat.persona_name,
        personaAvatar: chat.persona_avatar,
        lastMessage: chat.last_message,
        lastChatTime: chat.lastChatTime,
        messageCount: chat.message_count
      })),
      hearts: chats.length > 0 ? chats[0].current_hearts : 100
    };
    
    res.json(response);
    console.timeEnd('getChatListOptimized');
    
  } catch (error) {
    console.error('Chat list 조회 에러:', error);
    console.timeEnd('getChatListOptimized');
    res.status(500).json({ 
      ok: false, 
      error: '채팅 목록을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// GET /api/chat-data/stats - 성능 통계 조회 (개발용)
router.get('/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      // 테이블 크기 정보
      executeQuery(`
        SELECT 
          TABLE_NAME,
          TABLE_ROWS,
          ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as 'Size_MB'
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      `),
      
      // 인덱스 정보
      executeQuery(`
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          CARDINALITY,
          INDEX_TYPE
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME != 'PRIMARY'
        ORDER BY TABLE_NAME, INDEX_NAME
      `),
      
      // 활성 채팅방 통계
      executeQuery(`
        SELECT 
          COUNT(DISTINCT CONCAT(personaId, '_', characterId)) as active_chats,
          COUNT(DISTINCT personaId) as active_personas,
          COUNT(DISTINCT characterId) as active_characters,
          COUNT(*) as total_messages
        FROM chats 
        WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `)
    ]);

    res.json({
      ok: true,
      tableStats: stats[0],
      indexStats: stats[1],
      activityStats: stats[2][0]
    });

  } catch (error) {
    console.error('Stats 조회 에러:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router; 