const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');

// GET /api/hearts - 하트 잔액 조회 (병렬 처리 최적화)
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    // 병렬로 사용자 생성과 하트 조회 처리
    const [, results] = await Promise.all([
      executeMutation(
        'INSERT IGNORE INTO users (userId, hearts, displayName, createdAt) VALUES (?, ?, ?, NOW())',
        [userId, 100, `User_${userId}`]
      ),
      executeQuery(
        'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
      )
    ]);

    const hearts = results.length > 0 ? results[0].afterHearts : 100;
    
    // 캐싱 헤더 추가
    res.set({
      'Cache-Control': 'public, max-age=10',
      'ETag': `"hearts-${userId}-${hearts}"`
    });
    
    res.json({ ok: true, hearts });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: '하트 정보를 불러올 수 없습니다.'
    });
  }
});

// POST /api/hearts - 하트 거래 (사용/구매/환불) - 최적화됨
router.post('/', async (req, res) => {
  try {
    const { userId, amount = 1, type = 'chat', description = '', relatedId = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      });
    }

    // 병렬로 사용자 생성과 잔액 조회
    const [, balanceResult] = await Promise.all([
      executeMutation(
        'INSERT IGNORE INTO users (userId, hearts, displayName, createdAt) VALUES (?, ?, ?, NOW())',
        [userId, 100, `User_${userId}`]
      ),
      executeQuery(
        'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
      )
    ]);

    const currentBalance = balanceResult.length > 0 ? balanceResult[0].afterHearts : 100;
    let newBalance;

    // 거래 타입에 따른 잔액 계산
    switch (type) {
      case 'purchase':
        newBalance = currentBalance + parseInt(amount);
        break;
      case 'chat':
      case 'use':
        newBalance = Math.max(0, currentBalance - parseInt(amount));
        break;
      case 'refund':
        newBalance = currentBalance + parseInt(amount);
        break;
      default:
        newBalance = currentBalance;
    }

    // 하트 부족 체크
    if ((type === 'chat' || type === 'use') && currentBalance < parseInt(amount)) {
      return res.status(400).json({
        ok: false,
        error: '하트가 부족합니다.',
        currentHearts: currentBalance,
        requiredHearts: parseInt(amount)
      });
    }

    // 거래 기록 저장
    const result = await executeMutation(
      `INSERT INTO heart_transactions (userId, amount, type, description, relatedId, beforeHearts, afterHearts, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, parseInt(amount), type, description, relatedId, currentBalance, newBalance]
    );

    if (result.affectedRows > 0) {
      res.json({ 
        ok: true, 
        hearts: newBalance,
        transactionId: result.insertId
      });
    } else {
      res.status(500).json({ ok: false, error: '하트 거래 실패' });
    }
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: '하트 거래 중 오류가 발생했습니다.'
    });
  }
});

// GET /api/hearts/history - 하트 거래 내역 조회 (최적화됨)
router.get('/history', async (req, res) => {
  const { userId, limit = 20 } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    const transactions = await executeQuery(
      'SELECT id, amount, type, description, beforeHearts, afterHearts, createdAt FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?',
      [userId, Math.min(parseInt(limit), 50)]
    );

    res.json({ 
      ok: true, 
      transactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        beforeHearts: t.beforeHearts,
        afterHearts: t.afterHearts,
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: '하트 거래 내역을 불러올 수 없습니다.'
    });
  }
});

module.exports = router; 