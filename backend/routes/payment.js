const express = require('express');
const router = express.Router();
const { executeQuery, executeMutation } = require('../services/db');

// POST /api/payment - 결제 처리
router.post('/', async (req, res) => {
  try {
    const { userId, amount, paymentMethod, productName } = req.body;

    if (!userId || !amount || !paymentMethod) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId, amount, paymentMethod는 필수입니다.' 
      });
    }

    // 결제 기록 저장
    const result = await executeMutation(
      `INSERT INTO payments (userId, amount, paymentMethod, productName, status, createdAt) 
       VALUES (?, ?, ?, ?, 'completed', NOW())`,
      [userId, parseInt(amount), paymentMethod, productName || '하트 구매']
    );

    if (result.affectedRows > 0) {
      // 현재 하트 잔액 조회 (afterHearts 사용)
      const heartsResult = await executeQuery(
        'SELECT afterHearts FROM heart_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
      );

      const currentBalance = heartsResult.length > 0 ? heartsResult[0].afterHearts : 100;
      const heartsToAdd = parseInt(amount);
      const newBalance = currentBalance + heartsToAdd;

      // 하트 거래 기록 저장 (beforeHearts, afterHearts 구조 사용)
      await executeMutation(
        `INSERT INTO heart_transactions (userId, amount, type, description, relatedId, beforeHearts, afterHearts, createdAt) 
         VALUES (?, ?, 'purchase', ?, ?, ?, ?, NOW())`,
        [
          userId, 
          heartsToAdd, 
          `${productName || '하트 구매'} - ${paymentMethod}`, 
          result.insertId.toString(), 
          currentBalance,
          newBalance
        ]
      );

      res.json({ 
        ok: true, 
        paymentId: result.insertId,
        hearts: newBalance,
        beforeHearts: currentBalance,
        afterHearts: newBalance,
        heartsAdded: heartsToAdd,
        message: '결제가 완료되었습니다.' 
      });
    } else {
      res.status(500).json({ ok: false, error: '결제 처리 실패' });
    }
  } catch (error) {
    console.error('Payment 처리 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '결제 처리 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/payment - 결제 내역 조회
router.get('/', async (req, res) => {
  const { userId, limit = 20 } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'userId is required' 
    });
  }

  try {
    const payments = await executeQuery(
      'SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC LIMIT ?',
      [userId, parseInt(limit)]
    );

    res.json({ ok: true, payments });
  } catch (error) {
    console.error('Payment 조회 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '결제 내역을 불러올 수 없습니다.',
      details: error.message 
    });
  }
});

// GET /api/payment/verify - 결제 검증 (새로 추가)
router.get('/verify/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  
  if (!paymentId) {
    return res.status(400).json({ 
      ok: false, 
      error: 'paymentId is required' 
    });
  }

  try {
    const payments = await executeQuery(
      'SELECT * FROM payments WHERE id = ?',
      [paymentId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: '결제 정보를 찾을 수 없습니다.' 
      });
    }

    res.json({ ok: true, payment: payments[0] });
  } catch (error) {
    console.error('Payment 검증 에러:', error);
    res.status(500).json({ 
      ok: false, 
      error: '결제 검증 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router; 