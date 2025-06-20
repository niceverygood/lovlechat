import { useState, useEffect, useRef, useCallback } from 'react';

interface HeartData {
  hearts: number;
  lastUpdate: string;
}

interface UseHeartsReturn {
  hearts: number;
  loading: boolean;
  error: string | null;
  refreshHearts: () => Promise<void>;
  useHearts: (amount: number, description?: string, relatedId?: string) => Promise<boolean>;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3002';

// 🔥 강력한 중복 호출 방지 시스템
const heartCache = new Map<string, { data: HeartData; timestamp: number }>();
const pendingRequests = new Map<string, Promise<HeartData>>();
const lastCallTime = new Map<string, number>();

// 캐싱 시간 대폭 증가: 60초
const CACHE_DURATION = 60000; 
// 최소 호출 간격: 3초
const MIN_CALL_INTERVAL = 3000;

// 컴포넌트 마운트 상태 추적
const mountedComponents = new Set<string>();

// 캐시에서 하트 데이터 조회
function getCachedHearts(userId: string): HeartData | null {
  const cached = heartCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`💎 하트 캐시 히트: ${userId} (${cached.data.hearts}개)`);
    return cached.data;
  }
  return null;
}

// 캐시에 하트 데이터 저장
function setCachedHearts(userId: string, data: HeartData): void {
  heartCache.set(userId, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 하트 캐시 저장: ${userId} (${data.hearts}개)`);
}

// 🚫 중복 호출 완전 차단
function canMakeApiCall(userId: string): boolean {
  const lastCall = lastCallTime.get(userId);
  const now = Date.now();
  
  if (lastCall && now - lastCall < MIN_CALL_INTERVAL) {
    console.log(`⏳ API 호출 차단: ${userId} (${Math.ceil((MIN_CALL_INTERVAL - (now - lastCall)) / 1000)}초 대기)`);
    return false;
  }
  
  return true;
}

// 하트 데이터 가져오기 (강력한 중복 방지)
async function fetchHearts(userId: string): Promise<HeartData> {
  // 1. 캐시 확인
  const cached = getCachedHearts(userId);
  if (cached) {
    return cached;
  }

  // 2. 호출 빈도 제한 확인
  if (!canMakeApiCall(userId)) {
    const fallback = heartCache.get(userId)?.data || { hearts: 0, lastUpdate: new Date().toISOString() };
    return fallback;
  }

  // 3. 이미 진행 중인 요청 확인
  const pendingRequest = pendingRequests.get(userId);
  if (pendingRequest) {
    console.log(`🔄 진행중인 요청 대기: ${userId}`);
    return pendingRequest;
  }

  // 4. 새로운 API 요청
  const requestPromise = (async (): Promise<HeartData> => {
    try {
      lastCallTime.set(userId, Date.now());
      console.log(`🌐 하트 API 호출: ${userId}`);

      const response = await fetch(`${API_BASE_URL}/api/hearts?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '하트 조회 실패');
      }

      const heartData: HeartData = {
        hearts: data.hearts,
        lastUpdate: data.lastUpdate || new Date().toISOString()
      };

      // 캐시 저장
      setCachedHearts(userId, heartData);
      return heartData;

    } catch (error) {
      console.error('❌ 하트 API 에러:', error);
      // 에러 시 캐시된 데이터 반환
      const fallback = heartCache.get(userId)?.data || { hearts: 0, lastUpdate: new Date().toISOString() };
      return fallback;
    } finally {
      // 요청 완료 후 정리
      pendingRequests.delete(userId);
    }
  })();

  // 진행 중인 요청으로 등록
  pendingRequests.set(userId, requestPromise);
  return requestPromise;
}

// useHearts 훅
export function useHearts(userId: string | null): UseHeartsReturn {
  const [hearts, setHearts] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const componentId = useRef<string>(`hearts-${Date.now()}-${Math.random()}`);
  const isMountedRef = useRef<boolean>(true);

  // 컴포넌트 마운트 등록
  useEffect(() => {
    mountedComponents.add(componentId.current);
    return () => {
      isMountedRef.current = false;
      mountedComponents.delete(componentId.current);
    };
  }, []);

  // 하트 새로고침
  const refreshHearts = useCallback(async () => {
    if (!userId || !isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const data = await fetchHearts(userId);
      
      if (isMountedRef.current) {
        setHearts(data.hearts);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  // 하트 사용
  const useHearts = useCallback(async (amount: number, description?: string, relatedId?: string): Promise<boolean> => {
    if (!userId || !isMountedRef.current) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/hearts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amount: -amount,
          description: description || '하트 사용',
          relatedId
        }),
      });

      const data = await response.json();
      if (data.ok) {
        // 캐시 업데이트
        setCachedHearts(userId, {
          hearts: data.hearts,
          lastUpdate: new Date().toISOString()
        });
        
        if (isMountedRef.current) {
          setHearts(data.hearts);
        }
        return true;
      } else {
        throw new Error(data.error || '하트 사용 실패');
      }
    } catch (err) {
      console.error('하트 사용 실패:', err);
      return false;
    }
  }, [userId]);

  // 초기 로드 (한 번만)
  useEffect(() => {
    if (userId && isMountedRef.current) {
      refreshHearts();
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

// 캐시 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  heartCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION * 5) { // 5배 시간 후 정리
      heartCache.delete(key);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    console.log(`🧹 하트 캐시 정리: ${deletedCount}개 항목 삭제`);
  }
}, 300000); // 5분마다 