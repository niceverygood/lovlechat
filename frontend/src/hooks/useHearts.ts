import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/openai';

interface HeartData {
  hearts: number;
  lastUpdate: string;
}

interface UseHeartsReturn {
  hearts: number;
  loading: boolean;
  error: string | null;
  refreshHearts: () => Promise<void>;
  useHearts: (amount: number, description: string, relatedId?: string) => Promise<boolean>;
}

export function useHearts(userId: string | null): UseHeartsReturn {
  const [hearts, setHearts] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 하트 정보 조회
  const refreshHearts = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/hearts?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.ok) {
        setHearts(data.hearts);
      } else {
        setError(data.error || '하트 정보를 가져올 수 없습니다.');
      }
    } catch (err) {
      console.error('하트 조회 실패:', err);
      // 하트 시스템이 준비되지 않은 경우 기본값으로 설정
      setHearts(100); // 임시로 100개 표시
      setError(null); // 에러 표시하지 않음
      console.warn('하트 시스템 준비 중 - 임시로 100개 표시');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 하트 사용
  const useHearts = useCallback(async (
    amount: number, 
    description: string = '', 
    relatedId: string = ''
  ): Promise<boolean> => {
    if (!userId) {
      setError('로그인이 필요합니다.');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/hearts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amount,
          type: 'chat',
          description,
          relatedId
        })
      });

      const data = await response.json();

      if (data.ok) {
        // 하트 사용 성공시 로컬 상태 업데이트
        setHearts(data.afterHearts);
        setError(null);
        return true;
      } else {
        // 하트 부족 등의 에러
        setError(data.error || '하트 사용에 실패했습니다.');
        
        // 하트 부족시 최신 하트 정보로 업데이트 (백엔드 응답 구조에 맞게 수정)
        if (data.currentHearts !== undefined) {
          setHearts(data.currentHearts);
        }
        
        return false;
      }
    } catch (err) {
      console.error('하트 사용 실패:', err);
      setError('네트워크 오류가 발생했습니다.');
      return false;
    }
  }, [userId]);

  // 컴포넌트 마운트시 하트 정보 로드
  useEffect(() => {
    refreshHearts();
  }, [refreshHearts]);

  // userId 변경시 하트 정보 새로고침
  useEffect(() => {
    if (userId) {
      refreshHearts();
    } else {
      setHearts(0);
      setLoading(false);
      setError(null);
    }
  }, [userId, refreshHearts]);

  return {
    hearts,
    loading,
    error,
    refreshHearts,
    useHearts
  };
} 