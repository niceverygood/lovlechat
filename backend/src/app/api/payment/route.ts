import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '@/lib/cors';

// 아임포트 REST API 설정 (실제 운영용)
const IMP_KEY = process.env.IMP_KEY || '9022927126860124';
const IMP_SECRET = process.env.IMP_SECRET || 'b1d469864e7b5c52a357cd18c82c816941e2d0795030b7d4466e68c2bfdd1fd3e5c2bfd3a6d1c0a5';

// 실제 운영 환경 확인
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface PaymentVerifyRequest {
  imp_uid: string;
  merchant_uid: string;
  userId: string;
  heartCount: number;
  price: number;
}

// 아임포트 액세스 토큰 발급
async function getAccessToken() {
  console.log('아임포트 토큰 발급 시도...');
  
  const getToken = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imp_key: IMP_KEY,
      imp_secret: IMP_SECRET,
    }),
  });
  
  const tokenData = await getToken.json();
  console.log('토큰 발급 응답:', { code: tokenData.code, message: tokenData.message });
  
  if (tokenData.code !== 0) {
    throw new Error(`아임포트 토큰 발급 실패: ${tokenData.message}`);
  }
  
  return tokenData.response.access_token;
}

// 결제 정보 조회
async function getPaymentData(imp_uid: string, access_token: string) {
  console.log('결제 정보 조회 시도:', imp_uid);
  
  const getPaymentData = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
    method: 'GET',
    headers: { 'Authorization': access_token },
  });
  
  const paymentInfo = await getPaymentData.json();
  console.log('결제 정보 조회 응답:', { 
    code: paymentInfo.code, 
    message: paymentInfo.message,
    status: paymentInfo.response?.status,
    amount: paymentInfo.response?.amount,
    pg_provider: paymentInfo.response?.pg_provider 
  });
  
  return paymentInfo;
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentVerifyRequest = await request.json();
    const { imp_uid, merchant_uid, userId, heartCount, price } = body;

    console.log('결제 검증 요청:', { imp_uid, merchant_uid, userId, heartCount, price });

    // 1. 아임포트 액세스 토큰 발급
    const access_token = await getAccessToken();
    
    // 2. 아임포트에서 결제 정보 조회
    const paymentData = await getPaymentData(imp_uid, access_token);
    
    if (paymentData.code !== 0) {
      console.error('아임포트 API 오류:', {
        code: paymentData.code,
        message: paymentData.message,
        imp_uid
      });
      throw new Error(`결제 정보 조회 실패: ${paymentData.message}`);
    }

    const payment = paymentData.response;
    
    // 3. 결제 정보 검증 (실제 운영용 강화된 검증)
    if (payment.status !== 'paid') {
      console.error('결제 상태 오류:', payment.status);
      throw new Error(`결제가 완료되지 않았습니다. 상태: ${payment.status}`);
    }
    
    if (payment.amount !== price) {
      console.error('금액 불일치:', { expected: price, actual: payment.amount });
      throw new Error(`결제 금액이 일치하지 않습니다. 요청: ${price}원, 실제: ${payment.amount}원`);
    }
    
    if (payment.merchant_uid !== merchant_uid) {
      console.error('주문번호 불일치:', { expected: merchant_uid, actual: payment.merchant_uid });
      throw new Error('주문번호가 일치하지 않습니다');
    }

    // 추가 보안 검증 (개발 환경에서는 PG사 검증 완화)
    const allowedPgProviders = IS_PRODUCTION 
      ? ['html5_inicis'] 
      : ['html5_inicis', 'inicis', 'kcp', 'uplus', 'nice', 'jtnet'];
    
    if (!allowedPgProviders.includes(payment.pg_provider)) {
      console.error('PG사 불일치:', { expected: allowedPgProviders, actual: payment.pg_provider });
      throw new Error(`허용되지 않은 PG사입니다: ${payment.pg_provider}`);
    }

    // 결제 시간 검증 (개발 환경에서는 더 관대하게)
    const maxMinutes = IS_PRODUCTION ? 5 : 30; // 운영: 5분, 개발: 30분
    const paymentTime = new Date(payment.paid_at * 1000);
    const now = new Date();
    const timeDiff = (now.getTime() - paymentTime.getTime()) / 1000 / 60; // 분 단위
    if (timeDiff > maxMinutes) {
      console.error('결제 시간 초과:', { paymentTime, now, diffMinutes: timeDiff, maxMinutes });
      throw new Error(`결제 시간이 초과되었습니다 (${timeDiff.toFixed(1)}분 > ${maxMinutes}분)`);
    }
    
    // 4. 중복 결제 체크
    const [existingPayment] = await pool.execute(
      'SELECT id, status, createdAt FROM payments WHERE imp_uid = ?',
      [imp_uid]
    );
    
    if (Array.isArray(existingPayment) && existingPayment.length > 0) {
      const existing = existingPayment[0] as any;
      console.error('중복 결제 감지:', {
        imp_uid,
        existing_id: existing.id,
        existing_status: existing.status,
        existing_date: existing.createdAt
      });
      throw new Error(`이미 처리된 결제입니다 (ID: ${existing.id})`);
    }
    
    // 5. 트랜잭션 시작
    const connection = await pool.getConnection();
    await connection.query('START TRANSACTION');
    
    try {
      // 6. 결제 기록 저장
      await connection.execute(
        `INSERT INTO payments (
          imp_uid, merchant_uid, userId, amount, heartCount, status, createdAt
        ) VALUES (?, ?, ?, ?, ?, 'completed', NOW())`,
        [imp_uid, merchant_uid, userId, price, heartCount]
      );
      
      // 7. 사용자 하트 업데이트
      await connection.execute(
        'UPDATE users SET hearts = hearts + ? WHERE userId = ?',
        [heartCount, userId]
      );
      
      // 8. 업데이트된 하트 수 조회
      const [userResult] = await connection.execute(
        'SELECT hearts FROM users WHERE userId = ?',
        [userId]
      );
      
      const updatedHearts = Array.isArray(userResult) && userResult.length > 0 
        ? (userResult[0] as any).hearts 
        : 0;
      
      // 9. 트랜잭션 커밋
      await connection.query('COMMIT');
      connection.release();
      
      console.log('결제 완료:', { userId, heartCount, updatedHearts });
      
      return successResponse({
        message: '결제가 완료되었습니다',
        data: {
          heartCount,
          totalHearts: updatedHearts
        }
      });
      
    } catch (dbError) {
      // 롤백
      await connection.query('ROLLBACK');
      connection.release();
      throw dbError;
    }
    
  } catch (error: any) {
    console.error('결제 검증 오류:', error);
    return errorResponse(error.message || '결제 검증 중 오류가 발생했습니다');
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
} 