const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');

// GET /api/hearts - 하트 잔액 조회
router.get('/', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    // 사용자가 없으면 자동 생성
    await executeMutation(
      'INSERT IGNORE INTO users (userId, hearts, displayName, createdAt) VALUES (?, ?, ?, NOW())',
      [userId, 100, `User_${userId}`]
    );

    // afterHearts 컬럼을 사용하여 최신 하트 잔액 조회
    const results = await executeQuery(
      'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const hearts = results.length > 0 ? results[0].afterHearts : 100; // 신규 사용자는 100 하트로 시작
    res.json({ ok: true, hearts });
  } catch (error) {
    console.error('Hearts 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '하트 정보를 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// POST /api/hearts - 하트 거래 (사용/구매/환불)
router.post('/', async (req, res) => {
  try {
    const { userId, amount = 1, type = 'chat', description = '', relatedId = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      });
    }

    // 사용자가 없으면 자동 생성
    await executeMutation(
      'INSERT IGNORE INTO users (userId, hearts, displayName, createdAt) VALUES (?, ?, ?, NOW())',
      [userId, 100, `User_${userId}`]
    );

    // 현재 잔액 조회 (afterHearts 사용)
    const balanceResult = await executeQuery(
      'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const currentBalance = balanceResult.length > 0 ? balanceResult[0].afterHearts : 100; // 신규 사용자 기본 100 하트
    let newBalance;
    let beforeHearts = currentBalance;

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

    // 하트가 부족한 경우 체크
    if (type === 'chat' || type === 'use') {
      if (currentBalance < parseInt(amount)) {
        return res.status(400).json({
          ok: false,
          error: '하트가 부족합니다.',
          currentHearts: currentBalance,
          requiredHearts: parseInt(amount)
        });
      }
    }

    // 거래 기록 저장 (beforeHearts, afterHearts 구조 사용)
    const result = await executeMutation(
      `INSERT INTO heart_transactions (userId, amount, type, description, relatedId, beforeHearts, afterHearts, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId, 
        parseInt(amount), 
        type, 
        description, 
        relatedId, 
        beforeHearts,
        newBalance
      ]
    );

    if (result.affectedRows > 0) {
      res.json({ 
        ok: true, 
        hearts: newBalance,
        beforeHearts: beforeHearts,
        afterHearts: newBalance,
        transactionId: result.insertId,
        message: '하트 거래가 완료되었습니다.' 
      });
    } else {
      res.status(500).json({ ok: false, error: '하트 거래 실패' });
    }
  } catch (error) {
    console.error('Hearts 거래 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '하트 거래 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/hearts/history - 하트 거래 내역 조회 (새로 추가)
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
      'SELECT * FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 20',
      [userId]
    );

    res.json({ ok: true, transactions });
  } catch (error) {
    console.error('Hearts 내역 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '하트 거래 내역을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

module.exports = router; 