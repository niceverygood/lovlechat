// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout;
    let isComponentMounted = true;

    const setupAuth = async () => {
      try {
        console.log('🔐 Firebase Auth 초기화 시작...');
        
        // 20초 timeout 설정 (더 여유있게)
        timeoutId = setTimeout(() => {
          if (!isComponentMounted) return;
          
          console.warn('⚠️ Firebase Auth 초기화 시간 초과 - Guest 모드로 진행');
          setUser(null);
          setLoading(false);
          setAuthReady(true);
          setError('Firebase 연결 시간이 초과되었습니다. Guest 모드로 진행합니다.');
        }, 20000);

        // Firebase Auth 상태 리스너 설정
        unsubscribe = await onAuthStateChanged((u: User | null) => {
          if (!isComponentMounted) return;
          
          clearTimeout(timeoutId);
          console.log('✅ Firebase Auth 상태 변경:', u ? `로그인됨 (${u.email})` : '로그아웃됨');
          
          setUser(u);
          setLoading(false);
          setAuthReady(true);
          setError(null);
        });

        console.log('✅ Firebase Auth 리스너 설정 완료');
      } catch (error) {
        if (!isComponentMounted) return;
        
        clearTimeout(timeoutId);
        console.error('❌ Firebase auth setup error:', error);
        
        // Firebase 에러여도 앱은 계속 실행 (Guest 모드)
        setUser(null);
        setLoading(false);
        setAuthReady(true);
        
        const errorMessage = error instanceof Error ? error.message : 'Firebase 인증 초기화 실패';
        setError(`Firebase 인증 오류: ${errorMessage}`);
        
        // 에러가 발생해도 사용자에게는 앱을 계속 사용할 수 있도록 함
        console.warn('🔄 Firebase 에러 발생 - Guest 모드로 진행합니다.');
      }
    };

    setupAuth();

    return () => {
      isComponentMounted = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Auth cleanup error:', error);
        }
      }
    };
  }, []);

  return { 
    user, 
    loading, 
    authReady, 
    error,
    isAuthenticated: !!user,
    isGuest: authReady && !user
  };
}
