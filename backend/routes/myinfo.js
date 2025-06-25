const express = require('express');
const router = express.Router();
const { executeQuery, executeOptimizedQuery, executeJoinQuery } = require('../services/db');
const { cacheWrapper } = require('../services/cache');

// GET /api/myinfo - 사용자 정보 통합 조회 (user + personas + hearts)
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const { userId } = req.query;

  if (!userId || userId === 'guest') {
    return res.json({
      ok: true,
      user: { name: "게스트", avatar: "/default_profile.png" },
      personas: [],
      characters: [],
      hearts: 0,
      responseTime: Date.now() - startTime
    });
  }

  try {
    // 캐시에서 먼저 확인
    const cachedData = await cacheWrapper.getMyInfo(userId);
    if (cachedData) {
      console.log('🚀 MyInfo 캐시 히트:', userId);
      return res.json({
        ...cachedData,
        fromCache: true,
        responseTime: Date.now() - startTime
      });
    }

    console.log('⭕ MyInfo 캐시 미스, DB 조회:', userId);

    console.log('🚀 MyInfo 통합 쿼리 시작 - 4개 병렬 최적화된 조회');

    // 병렬로 모든 데이터 조회 (안전한 쿼리)
    const [userResult, personasResult, heartsResult, charactersResult] = await Promise.all([
      // 사용자 기본 정보 (필수 컬럼만)
      executeQuery(`
        SELECT userId, displayName, email, createdAt
        FROM users 
        WHERE userId = ? 
        LIMIT 1
      `, [userId]),
      
      // 사용자의 모든 페르소나 (필수 컬럼만)
      executeQuery(`
        SELECT id, name, avatar, gender, age, job, info, habit, createdAt
        FROM personas 
        WHERE userId = ? 
        ORDER BY createdAt DESC
      `, [userId]),
      
      // 최신 하트 잔액 (거래 내역에서 조회)
      executeQuery(`
        SELECT afterHearts
        FROM heart_transactions 
        WHERE userId = ? 
        ORDER BY createdAt DESC 
        LIMIT 1
      `, [userId]),

      // 사용자가 생성한 캐릭터들 (필수 컬럼만)
      executeQuery(`
        SELECT id, profileImg, name, tags, category, gender, scope, age, job, 
               oneLiner, background, personality, habit, likes as \`like\`, 
               dislikes as dislike, extraInfos, firstScene, firstMessage, 
               backgroundImg, createdAt
        FROM character_profiles 
        WHERE userId = ? 
        ORDER BY createdAt DESC
      `, [userId])
    ]);

    // 사용자 정보 구성
    const user = userResult.length > 0 ? {
      uid: userResult[0].userId,
      userId: userResult[0].userId, // 호환성
      name: userResult[0].displayName || "사용자",
      email: userResult[0].email,
      createdAt: userResult[0].createdAt
    } : {
      uid: userId,
      userId,
      name: "사용자",
      email: null,
      createdAt: new Date()
    };

    // 페르소나 정보 정리 (불필요한 필드 제거)
    const personas = personasResult.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      gender: p.gender,
      age: p.age,
      job: p.job,
      info: p.info,
      habit: p.habit
    }));

    // 캐릭터 정보 정리 (태그 파싱)
    const characters = charactersResult.map(char => ({
      id: char.id,
      profileImg: char.profileImg,
      name: char.name,
      tags: char.tags,
      selectedTags: (() => {
        try {
          if (Array.isArray(char.tags)) return char.tags;
          if (typeof char.tags === 'string' && char.tags.startsWith('[')) {
            return JSON.parse(char.tags);
          }
          if (typeof char.tags === 'string' && char.tags.length > 0) {
            return char.tags.split(',').map(t => t.trim());
          }
          return [];
        } catch (e) {
          return [];
        }
      })(),
      category: char.category,
      gender: char.gender,
      scope: char.scope,
      age: char.age,
      job: char.job,
      oneLiner: char.oneLiner,
      background: char.background,
      personality: char.personality,
      habit: char.habit,
      like: char.like,
      dislike: char.dislike,
      extraInfos: char.extraInfos,
      firstScene: char.firstScene,
      firstMessage: char.firstMessage,
      backgroundImg: char.backgroundImg
    }));

    // 하트 잔액 (거래 내역에서 조회)
    const hearts = heartsResult.length > 0 ? heartsResult[0].afterHearts : 100;

    const responseData = {
      ok: true,
      user,
      personas,
      characters,
      hearts,
      responseTime: Date.now() - startTime
    };

    // 캐시에 저장 (5분)
    await cacheWrapper.setMyInfo(userId, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('MyInfo API 에러:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('사용자 ID:', userId);
    res.status(500).json({ 
      ok: false, 
      error: '사용자 정보를 불러올 수 없습니다.',
      debug: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

// GET /api/myinfo/stats - 사용자 활동 통계
router.get('/stats', async (req, res) => {
  const startTime = Date.now();
  const { userId } = req.query;

  if (!userId || userId === 'guest') {
    return res.json({
      ok: true,
      stats: {
        totalChats: 0,
        activeCharacters: 0,
        totalMessages: 0,
        avgFavor: 0
      },
      responseTime: Date.now() - startTime
    });
  }

  try {
    // 캐시에서 먼저 확인
    const cachedStats = await cacheWrapper.getUserStats(userId);
    if (cachedStats) {
      console.log('🚀 MyInfo Stats 캐시 히트:', userId);
      return res.json({
        ok: true,
        stats: cachedStats,
        fromCache: true,
        responseTime: Date.now() - startTime
      });
    }

    console.log('⭕ MyInfo Stats 캐시 미스, DB 조회:', userId);

    console.log('🚀 MyInfo Stats 통합 쿼리 시작 - 3개 병렬 최적화된 조회');

    // 병렬로 통계 데이터 조회 (안전한 쿼리)
    const [chatStats, favorStats, heartStats] = await Promise.all([
      // 채팅 통계 (필수 집계만)
      executeQuery(`
        SELECT 
          COUNT(DISTINCT CONCAT(c.personaId, '_', c.characterId)) as totalChats,
          COUNT(DISTINCT c.characterId) as activeCharacters,
          COUNT(c.id) as totalMessages,
          MAX(c.createdAt) as lastActivity
        FROM chats c
        INNER JOIN personas p ON c.personaId = p.id
        WHERE p.userId = ?
      `, [userId]),
      
      // 호감도 통계 (필수 집계만)
      executeQuery(`
        SELECT 
          AVG(cf.favor) as avgFavor,
          MAX(cf.favor) as maxFavor,
          COUNT(cf.id) as totalFavors
        FROM character_favors cf
        INNER JOIN personas p ON cf.personaId = p.id
        WHERE p.userId = ?
      `, [userId]),
      
      // 하트 사용 통계 (필수 집계만)
      executeQuery(`
        SELECT 
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as totalUsed,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as totalEarned,
          COUNT(id) as totalTransactions
        FROM heart_transactions
        WHERE userId = ?
      `, [userId])
    ]);

    const stats = {
      totalChats: chatStats[0]?.totalChats || 0,
      activeCharacters: chatStats[0]?.activeCharacters || 0,
      totalMessages: chatStats[0]?.totalMessages || 0,
      lastActivity: chatStats[0]?.lastActivity,
      avgFavor: Math.round(favorStats[0]?.avgFavor || 0),
      maxFavor: favorStats[0]?.maxFavor || 0,
      totalFavors: favorStats[0]?.totalFavors || 0,
      heartsUsed: heartStats[0]?.totalUsed || 0,
      heartsEarned: heartStats[0]?.totalEarned || 0,
      totalTransactions: heartStats[0]?.totalTransactions || 0
    };

    // 캐시에 저장 (15분)
    await cacheWrapper.setUserStats(userId, stats);

    res.json({
      ok: true,
      stats,
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('MyInfo Stats API 에러:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('사용자 ID:', userId);
    res.status(500).json({ 
      ok: false, 
      error: '통계 정보를 불러올 수 없습니다.',
      debug: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

module.exports = router; 