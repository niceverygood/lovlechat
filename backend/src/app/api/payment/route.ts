import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { CORS_HEADERS } from '@/lib/cors';

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

// 성공 응답 헬퍼
function successResponse(data: any) {
  return NextResponse.json({
    success: true,
    ok: true,
    ...data
  }, {
    status: 200,
    headers: CORS_HEADERS
  });
}

// 오류 응답 헬퍼
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({
    success: false,
    ok: false,
    error: message
  }, {
    status,
    headers: CORS_HEADERS
  });
}

// 아임포트 액세스 토큰 발급
async function getIamportToken(): Promise<string> {
  const response = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imp_key: process.env.IAMPORT_API_KEY,
      imp_secret: process.env.IAMPORT_API_SECRET,
    }),
  });

  const data = await response.json();
  console.log('토큰 발급 응답:', data);
  
  if (data.code !== 0) {
    throw new Error('아임포트 토큰 발급 실패');
  }

  return data.response.access_token;
}

// 아임포트 결제 정보 조회
async function getPaymentData(imp_uid: string, access_token: string) {
  const response = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
    },
  });

  return response.json();
}

// 결제 검증 및 처리
export async function POST(request: NextRequest) {
  let connection: any = null;
  
  try {
    const body = await request.json();
    const { imp_uid, merchant_uid, userId, heartCount, price } = body;

    console.log('결제 검증 요청:', { imp_uid, merchant_uid, userId, heartCount, price });

    // 1. 필수 파라미터 검증
    if (!imp_uid || !merchant_uid || !userId || !heartCount || !price) {
      return errorResponse('필수 파라미터가 누락되었습니다.');
    }

    // 2. 아임포트 토큰 발급
    console.log('아임포트 토큰 발급 시도...');
    const access_token = await getIamportToken();
    console.log('토큰 발급 성공');

    // 3. 아임포트에서 결제 정보 조회
    console.log('결제 정보 조회 시도:', imp_uid);
    const paymentData = await getPaymentData(imp_uid, access_token);
    console.log('결제 정보 조회 응답:', paymentData);
    
    if (paymentData.code !== 0) {
      throw new Error('결제 정보 조회 실패');
    }

    const payment = paymentData.response;
    
    // 4. 결제 검증 (금액, 상태 확인)
    if (payment.amount !== price) {
      throw new Error(`결제 금액이 일치하지 않습니다. 요청: ${price}, 실제: ${payment.amount}`);
    }

    if (payment.status !== 'paid') {
      throw new Error(`결제가 완료되지 않았습니다. 상태: ${payment.status}`);
    }

    // 5. DB 연결 및 트랜잭션 시작
    connection = await pool.getConnection();
    
    // 트랜잭션 시작 (올바른 방법)
    await connection.beginTransaction();
    
    try {
      // 6. 결제 기록 저장 (execute() 메서드 사용)
      await connection.execute(
        `INSERT INTO payments (
          imp_uid, merchant_uid, userId, amount, heartCount, status, createdAt
        ) VALUES (?, ?, ?, ?, ?, 'completed', NOW())`,
        [imp_uid, merchant_uid, userId, price, heartCount]
      );
      
      // 7. 사용자 하트 업데이트 (execute() 메서드 사용)
      await connection.execute(
        'UPDATE users SET hearts = hearts + ? WHERE userId = ?',
        [heartCount, userId]
      );
      
      // 8. 업데이트된 하트 수 조회 (execute() 메서드 사용)
      const [userResult] = await connection.execute(
        'SELECT hearts FROM users WHERE userId = ?',
        [userId]
      );
      
      const updatedHearts = Array.isArray(userResult) && userResult.length > 0 
        ? (userResult[0] as any).hearts 
        : 0;
      
      // 9. 하트 충전 내역 저장 (execute() 메서드 사용)
      await connection.execute(
        'INSERT INTO heart_transactions (userId, amount, type, description, beforeHearts, afterHearts, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, heartCount, 'purchase', `하트 충전 (결제: ${price}원)`, updatedHearts - heartCount, updatedHearts, imp_uid]
      );
      
      // 10. 트랜잭션 커밋 (올바른 방법)
      await connection.commit();
      
      console.log('결제 완료:', { userId, heartCount, updatedHearts });
      
      return successResponse({
        message: '결제가 완료되었습니다',
        data: {
          heartCount,
          totalHearts: updatedHearts
        }
      });
      
    } catch (dbError) {
      // 트랜잭션 롤백 (올바른 방법)
      await connection.rollback();
      console.error('DB 트랜잭션 오류:', dbError);
      throw dbError;
    }
    
  } catch (error: any) {
    console.error('결제 검증 오류:', error);
    return errorResponse(error.message || '결제 검증 중 오류가 발생했습니다');
  } finally {
    // 연결 해제
    if (connection) {
      connection.release();
    }
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
} 