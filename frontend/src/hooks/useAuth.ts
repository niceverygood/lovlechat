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

    const setupAuth = async () => {
      try {
        console.log('🔐 Firebase Auth 초기화 시작...');
        
        // 15초 timeout 설정 (더 여유있게)
        timeoutId = setTimeout(() => {
          console.warn('⚠️ Firebase Auth 초기화 시간 초과 - Guest 모드로 진행');
          setUser(null);
          setLoading(false);
          setAuthReady(true);
          setError('Firebase 연결 시간이 초과되었습니다. Guest 모드로 진행합니다.');
        }, 15000);

        unsubscribe = await onAuthStateChanged((u: User | null) => {
          clearTimeout(timeoutId);
          console.log('✅ Firebase Auth 상태 변경:', u ? '로그인됨' : '로그아웃됨');
          setUser(u);
          setLoading(false);
          setAuthReady(true);
          setError(null);
        });

        console.log('✅ Firebase Auth 초기화 완료');
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Firebase auth setup error:', error);
        
        // Firebase 에러여도 앱은 계속 실행 (Guest 모드)
        setUser(null);
        setLoading(false);
        setAuthReady(true);
        setError(error instanceof Error ? error.message : 'Firebase 인증 초기화 실패');
        
        // 에러가 발생해도 사용자에게는 간단한 메시지만 표시
        console.warn('🔄 Firebase 에러 발생 - Guest 모드로 진행합니다.');
      }
    };

    setupAuth();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { user, loading, authReady, error };
}
