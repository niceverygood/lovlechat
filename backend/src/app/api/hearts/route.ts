import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/db-helper';
import { CORS_HEADERS } from '../../../lib/cors';

// 🎯 사용자 하트 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        ok: false,
        error: 'userId가 필요합니다.'
      }, {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // 사용자 하트 조회 (없으면 자동 생성)
    let user = await executeQuery(
      'SELECT userId, hearts, lastHeartUpdate FROM users WHERE userId = ?',
      [userId],
      5000
    );

    console.log('DB 조회 결과:', { userId, user }); // 디버깅 로그

    // 사용자가 없으면 새로 생성 (초기 하트 100개)
    if (!user || user.length === 0) {
      console.log('사용자 없음 - 새로 생성:', userId);
      await executeQuery(
        'INSERT INTO users (userId, hearts) VALUES (?, 100) ON DUPLICATE KEY UPDATE hearts = hearts',
        [userId],
        5000
      );
      
      user = await executeQuery(
        'SELECT userId, hearts, lastHeartUpdate FROM users WHERE userId = ?',
        [userId],
        5000
      );
      console.log('생성 후 사용자:', user);
    } else {
      console.log('기존 사용자 발견:', user[0]);
    }

    return NextResponse.json({
      ok: true,
      hearts: user[0]?.hearts || 0,
      lastUpdate: user[0]?.lastHeartUpdate,
      message: '하트 조회 성공'
    }, {
      status: 200,
      headers: CORS_HEADERS
    });

  } catch (error: any) {
    console.error('하트 조회 실패:', error);
    return NextResponse.json({
      ok: false,
      error: '하트 조회 중 오류가 발생했습니다.',
      details: error.message
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

// 💖 하트 사용 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount = 10, type = 'chat', description = '', relatedId = '' } = body;

    if (!userId) {
      return NextResponse.json({
        ok: false,
        error: 'userId가 필요합니다.'
      }, {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    if (amount <= 0) {
      return NextResponse.json({
        ok: false,
        error: '사용할 하트 수는 0보다 커야 합니다.'
      }, {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // 현재 하트 조회
    const user = await executeQuery(
      'SELECT hearts FROM users WHERE userId = ?',
      [userId],
      5000
    );

    if (!user || user.length === 0) {
      // 사용자가 없으면 새로 생성
      await executeQuery(
        'INSERT INTO users (userId, hearts) VALUES (?, 100)',
        [userId],
        5000
      );
      
      const newUser = await executeQuery(
        'SELECT hearts FROM users WHERE userId = ?',
        [userId],
        5000
      );
      
      if (newUser[0].hearts < amount) {
        return NextResponse.json({
          ok: false,
          error: '하트가 부족합니다.',
          currentHearts: newUser[0].hearts,
          requiredHearts: amount
        }, {
          status: 402, // Payment Required
          headers: CORS_HEADERS
        });
      }
    }

    const currentHearts = user[0]?.hearts || 0;

    // 하트 부족 체크
    if (currentHearts < amount) {
      return NextResponse.json({
        ok: false,
        error: '하트가 부족합니다. 하트를 충전해주세요! 💖',
        currentHearts,
        requiredHearts: amount,
        needMore: amount - currentHearts
      }, {
        status: 402, // Payment Required
        headers: CORS_HEADERS
      });
    }

    const newHearts = currentHearts - amount;

    // 트랜잭션으로 하트 차감 및 내역 저장
    await executeQuery('START TRANSACTION', [], 5000);

    try {
      // 하트 차감
      await executeQuery(
        'UPDATE users SET hearts = ?, lastHeartUpdate = NOW() WHERE userId = ?',
        [newHearts, userId],
        5000
      );

      // 사용 내역 저장
      await executeQuery(
        'INSERT INTO heart_transactions (userId, amount, type, description, beforeHearts, afterHearts, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, -amount, type, description, currentHearts, newHearts, relatedId],
        5000
      );

      await executeQuery('COMMIT', [], 5000);

      return NextResponse.json({
        ok: true,
        message: `하트 ${amount}개를 사용했습니다. 💖`,
        beforeHearts: currentHearts,
        afterHearts: newHearts,
        usedHearts: amount
      }, {
        status: 200,
        headers: CORS_HEADERS
      });

    } catch (error) {
      await executeQuery('ROLLBACK', [], 5000);
      throw error;
    }

  } catch (error: any) {
    console.error('하트 사용 실패:', error);
    return NextResponse.json({
      ok: false,
      error: '하트 사용 중 오류가 발생했습니다.',
      details: error.message
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
} 