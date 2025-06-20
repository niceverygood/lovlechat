import { useState, useEffect, useCallback, useRef } from 'react';
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

// 글로벌 캐시와 중복 요청 방지
const heartCache = new Map<string, { data: HeartData; timestamp: number }>();
const pendingRequests = new Map<string, Promise<HeartData>>();
const CACHE_DURATION = 10000; // 10초 캐시

// 캐시에서 하트 데이터 조회
function getCachedHearts(userId: string): HeartData | null {
  const cached = heartCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// 캐시에 하트 데이터 저장
function setCachedHearts(userId: string, data: HeartData) {
  heartCache.set(userId, { data, timestamp: Date.now() });
}

// 실제 API 호출 (중복 방지)
async function fetchHearts(userId: string): Promise<HeartData> {
  // 이미 진행 중인 요청이 있으면 기다림
  if (pendingRequests.has(userId)) {
    return pendingRequests.get(userId)!;
  }

  // 새로운 요청 생성
  const request = (async (): Promise<HeartData> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hearts?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.ok) {
        const heartData: HeartData = {
          hearts: data.hearts,
          lastUpdate: data.lastUpdate
        };
        setCachedHearts(userId, heartData);
        return heartData;
      } else {
        throw new Error(data.error || '하트 정보를 가져올 수 없습니다.');
      }
    } finally {
      // 요청 완료 후 pendingRequests에서 제거
      pendingRequests.delete(userId);
    }
  })();

  // 진행 중인 요청으로 등록
  pendingRequests.set(userId, request);
  return request;
}

export function useHearts(userId: string | null): UseHeartsReturn {
  const [hearts, setHearts] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // 하트 정보 조회 (캐싱 적용)
  const refreshHearts = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 캐시에서 먼저 확인
      const cached = getCachedHearts(userId);
      if (cached) {
        setHearts(cached.hearts);
        setLoading(false);
        return;
      }

      // 캐시에 없으면 API 호출
      const heartData = await fetchHearts(userId);
      setHearts(heartData.hearts);
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

  // 하트 사용 (캐시 업데이트 포함)
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
        // 하트 사용 성공시 로컬 상태 및 캐시 업데이트
        const newHearts = data.afterHearts;
        setHearts(newHearts);
        setCachedHearts(userId, { hearts: newHearts, lastUpdate: new Date().toISOString() });
        setError(null);
        return true;
      } else {
        // 하트 부족 등의 에러
        setError(data.error || '하트 사용에 실패했습니다.');
        
        // 하트 부족시 최신 하트 정보로 업데이트
        if (data.currentHearts !== undefined) {
          setHearts(data.currentHearts);
          setCachedHearts(userId, { hearts: data.currentHearts, lastUpdate: new Date().toISOString() });
        }
        
        return false;
      }
    } catch (err) {
      console.error('하트 사용 실패:', err);
      setError('네트워크 오류가 발생했습니다.');
      return false;
    }
  }, [userId]);

  // userId 변경시에만 하트 정보 새로고침
  useEffect(() => {
    if (userId && userId !== lastUserIdRef.current) {
      lastUserIdRef.current = userId;
      refreshHearts();
    } else if (!userId) {
      setHearts(0);
      setLoading(false);
      setError(null);
      lastUserIdRef.current = null;
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