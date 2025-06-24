const express = require('express');
const router = express.Router();
const { executeQuery } = require('../services/db');

// GET /api/myinfo - 사용자 정보 통합 조회 (user + personas + hearts)
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const { userId } = req.query;

  if (!userId || userId === 'guest') {
    return res.json({
      ok: true,
      user: { name: "게스트", avatar: "/default_profile.png" },
      personas: [],
      hearts: 0,
      responseTime: Date.now() - startTime
    });
  }

  try {
    // 병렬로 모든 데이터 조회
    const [userResult, personasResult, heartsResult] = await Promise.all([
      // 사용자 기본 정보 (Firebase 정보 기반)
      executeQuery(`
        SELECT userId, displayName, createdAt
        FROM users 
        WHERE userId = ? 
        LIMIT 1
      `, [userId]),
      
      // 사용자의 모든 페르소나
      executeQuery(`
        SELECT id, name, avatar, gender, age, job, info, habit, createdAt
        FROM personas 
        WHERE userId = ? 
        ORDER BY createdAt DESC
      `, [userId]),
      
      // 최신 하트 잔액
      executeQuery(`
        SELECT afterHearts
        FROM heart_transactions 
        WHERE userId = ? 
        ORDER BY createdAt DESC 
        LIMIT 1
      `, [userId])
    ]);

    // 사용자 정보 구성
    const user = userResult.length > 0 ? {
      userId: userResult[0].userId,
      name: userResult[0].displayName,
      createdAt: userResult[0].createdAt
    } : {
      userId,
      name: "사용자",
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

    // 하트 잔액
    const hearts = heartsResult.length > 0 ? heartsResult[0].afterHearts : 100;

    res.json({
      ok: true,
      user,
      personas,
      hearts,
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('MyInfo API 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '사용자 정보를 불러올 수 없습니다.',
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
    // 병렬로 통계 데이터 조회
    const [chatStats, favorStats, heartStats] = await Promise.all([
      // 채팅 통계
      executeQuery(`
        SELECT 
          COUNT(DISTINCT CONCAT(c.personaId, '_', c.characterId)) as totalChats,
          COUNT(DISTINCT c.characterId) as activeCharacters,
          COUNT(*) as totalMessages,
          MAX(c.createdAt) as lastActivity
        FROM chats c
        JOIN personas p ON c.personaId = p.id
        WHERE p.userId = ?
      `, [userId]),
      
      // 호감도 통계
      executeQuery(`
        SELECT 
          AVG(cf.favor) as avgFavor,
          MAX(cf.favor) as maxFavor,
          COUNT(*) as totalFavors
        FROM character_favors cf
        JOIN personas p ON cf.personaId = p.id
        WHERE p.userId = ?
      `, [userId]),
      
      // 하트 사용 통계
      executeQuery(`
        SELECT 
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as totalUsed,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as totalEarned,
          COUNT(*) as totalTransactions
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

    res.json({
      ok: true,
      stats,
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('MyInfo Stats API 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '통계 정보를 불러올 수 없습니다.',
      responseTime: Date.now() - startTime
    });
  }
});

module.exports = router; 