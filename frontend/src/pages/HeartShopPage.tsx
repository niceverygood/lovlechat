import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import Toast from "../components/Toast";
import { apiPost, API_BASE_URL } from "../lib/api";

// 아임포트 타입 선언
declare global {
  interface Window {
    IMP: any;
  }
}

const HEART_PRODUCTS = [
  { count: 300, price: 3300, bonus: 43 },
  { count: 508, price: 5500, bonus: 45 },
  { count: 612, price: 6600, bonus: 46 },
  { count: 927, price: 9900, bonus: 47 },
  { count: 1220, price: 12900, bonus: 49 },
];

// 아임포트 가맹점 식별코드
const IMP_CODE = "imp20122888";

export default function HeartShopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hearts, refreshHearts } = useHearts(user?.uid || null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // 아임포트 초기화
    if (window.IMP) {
      window.IMP.init(IMP_CODE);
    }
  }, []);

  const handlePayment = async (product: typeof HEART_PRODUCTS[0]) => {
    if (!user) {
      setToast({ message: '로그인이 필요합니다.', type: 'error' });
      return;
    }

    if (!window.IMP) {
      setToast({ message: '결제 모듈을 로드하는 중입니다. 잠시 후 다시 시도해주세요.', type: 'error' });
      return;
    }

    setIsLoading(true);

    // 주문번호 생성 (타임스탬프 + 유저ID + 랜덤값)
    const merchant_uid = `hearts_${Date.now()}_${user.uid}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 실제 하트 개수 (보너스 포함)
    const totalHearts = Math.floor(product.count * (1 + product.bonus / 100));

    const paymentData = {
      pg: 'html5_inicis',  // PG사 (KG이니시스)
      pay_method: 'card',  // 결제수단
      merchant_uid,        // 주문번호
      name: `러블챗 하트 ${totalHearts.toLocaleString()}개`,  // 상품명
      amount: product.price,  // 결제금액
      buyer_email: user.email || 'user@lovlechat.com',
      buyer_name: user.displayName || '사용자',
      buyer_tel: '010-0000-0000',  // 실제 운영시 사용자 입력 필요
      buyer_addr: '서울특별시',     // 실제 운영시 사용자 입력 필요
      buyer_postcode: '123-456',   // 실제 운영시 사용자 입력 필요
      m_redirect_url: `${window.location.origin}/payment/complete`, // 결제 완료 후 리다이렉트
      // 실제 결제 모드 설정
      digital: true,   // 디지털 상품 (하트)
      app_scheme: 'lovlechat',  // 앱 스킴
      notice_url: `${API_BASE_URL}/api/payment/webhook`, // 웹훅 URL
      confirm_url: `${API_BASE_URL}/api/payment/confirm`, // 결제 확인 URL
    };

    try {
      console.log('결제 요청 데이터:', paymentData);
      
      // 아임포트 결제 요청
      window.IMP.request_pay(paymentData, async (response: any) => {
        console.log('아임포트 응답:', response);
        
        try {
          if (response.success) {
            console.log('결제 성공:', response);
            setToast({ message: '결제 검증 중입니다...', type: 'success' });
            
            // 백엔드에 결제 검증 요청
            const verifyData = await apiPost('/api/payment', {
              imp_uid: response.imp_uid,
              merchant_uid: response.merchant_uid,
              userId: user.uid,
              heartCount: totalHearts,
              price: product.price,
            });
            console.log('검증 응답 데이터:', verifyData);

            if (verifyData.success || verifyData.ok) {
              console.log('결제 검증 성공:', verifyData);
              setToast({ 
                message: `결제가 완료되었습니다! 하트 ${totalHearts.toLocaleString()}개가 지급되었습니다.`, 
                type: 'success' 
              });
              
              // 하트 정보 새로고침
              await refreshHearts();
              
              // 3초 후 이전 페이지로 이동
              setTimeout(() => {
                navigate(-1);
              }, 3000);
              
            } else {
              console.error('결제 검증 실패:', verifyData);
              const errorMessage = verifyData.error || verifyData.message || '결제 검증에 실패했습니다.';
              setToast({ 
                message: `결제 검증 실패: ${errorMessage}`, 
                type: 'error' 
              });
              throw new Error(errorMessage);
            }
          } else {
            // 결제 실패
            console.log('결제 실패:', response);
            const errorMessage = response.error_msg || response.error_code || '결제가 취소되었습니다.';
            setToast({ 
              message: `결제 실패: ${errorMessage}`, 
              type: 'error' 
            });
          }
        } catch (error: any) {
          console.error('결제 검증 오류:', error);
          setToast({ 
            message: error.message || '결제 처리 중 오류가 발생했습니다.', 
            type: 'error' 
          });
        } finally {
          setIsLoading(false);
        }
      });
    } catch (error: any) {
      console.error('결제 요청 오류:', error);
      setToast({ 
        message: '결제 요청 중 오류가 발생했습니다.', 
        type: 'error' 
      });
      setIsLoading(false);
    }
  };

  const closeToast = () => {
    setToast(null);
  };

  return (
    <div style={{ background: "#18171c", minHeight: "100vh", color: "#fff", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '22px 0 18px 0', justifyContent: 'center', borderBottom: '1.5px solid #222', background: '#18171c', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, position: 'absolute', left: 18, top: 22, cursor: 'pointer' }}>&larr;</button>
        <span style={{ fontWeight: 700, fontSize: 22 }}>하트샵</span>
      </div>

      {/* 현재 하트 수 표시 */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px 0 16px' }}>
        <div style={{
          background: '#2a2a2a',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}>
          <span style={{ fontSize: 24 }}>❤️</span>
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            현재 보유: {hearts?.toLocaleString() || 0}개
          </span>
        </div>
      </div>

      {/* 구매 리스트 */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        {HEART_PRODUCTS.map((item, idx) => {
          const totalHearts = Math.floor(item.count * (1 + item.bonus / 100));
          
          return (
            <div key={item.count} style={{
              background: '#23222a',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 20px',
              marginBottom: 18,
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span style={{ fontSize: 34, marginRight: 8 }}>❤️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: 1 }}>
                    {totalHearts.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    기본 {item.count.toLocaleString()} + 보너스 {(totalHearts - item.count).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#ff4081', fontWeight: 700, fontSize: 15 }}>
                  +{item.bonus}% BONUS
                </span>
                <button 
                  onClick={() => handlePayment(item)}
                  disabled={isLoading}
                  style={{ 
                    background: isLoading ? '#666' : '#ff4081', 
                    color: '#fff', 
                    fontWeight: 700, 
                    fontSize: 18, 
                    border: 'none', 
                    borderRadius: 16, 
                    padding: '7px 28px', 
                    cursor: isLoading ? 'not-allowed' : 'pointer', 
                    boxShadow: '0 2px 8px #ff408133', 
                    transition: 'background 0.2s', 
                    height: 38, 
                    display: 'flex', 
                    alignItems: 'center' 
                  }}
                >
                  {isLoading ? '처리중...' : `₩${item.price.toLocaleString()}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 안내 문구 */}
      <div style={{ maxWidth: 420, margin: '20px auto 0', padding: '0 16px' }}>
        <div style={{ 
          fontSize: 12, 
          color: '#888', 
          textAlign: 'center', 
          lineHeight: 1.4,
          padding: '16px',
          background: '#1a1a1a',
          borderRadius: 8
        }}>
          • 결제는 안전하게 암호화되어 처리됩니다<br/>
          • 결제 완료 후 하트가 즉시 지급됩니다<br/>
          • 문의사항이 있으시면 고객센터로 연락주세요
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
} 