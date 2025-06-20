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

// 글로벌 캐시와 중복 요청 방지 (시간 연장)
const heartCache = new Map<string, { data: HeartData; timestamp: number }>();
const pendingRequests = new Map<string, Promise<HeartData>>();
const CACHE_DURATION = 30000; // 30초 캐시 (기존 10초에서 증가)

// 마지막 API 호출 시간 추적 (과도한 호출 방지)
const lastCallTime = new Map<string, number>();
const MIN_CALL_INTERVAL = 1000; // 1초 간격 제한

// 캐시에서 하트 데이터 조회
function getCachedHearts(userId: string): HeartData | null {
  const cached = heartCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('💾 하트 캐시 히트:', cached.data);
    return cached.data;
  }
  return null;
}

// 캐시에 하트 데이터 저장
function setCachedHearts(userId: string, data: HeartData) {
  heartCache.set(userId, { data, timestamp: Date.now() });
  console.log('💾 하트 캐시 저장:', data);
}

// 실제 API 호출 (중복 방지 + 호출 빈도 제한)
async function fetchHearts(userId: string): Promise<HeartData> {
  // 호출 빈도 제한 확인
  const lastCall = lastCallTime.get(userId) || 0;
  const now = Date.now();
  if (now - lastCall < MIN_CALL_INTERVAL) {
    console.log('⏱️ 하트 API 호출 빈도 제한 (1초 대기)');
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - (now - lastCall)));
  }

  // 이미 진행 중인 요청이 있으면 기다림
  if (pendingRequests.has(userId)) {
    console.log('⏳ 진행 중인 하트 API 요청 대기...');
    return pendingRequests.get(userId)!;
  }

  // 새로운 요청 생성
  const request = (async (): Promise<HeartData> => {
    try {
      lastCallTime.set(userId, Date.now());
      console.log('🔄 하트 API 호출:', userId);
      
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
  const mountedRef = useRef<boolean>(true);

  // 하트 정보 조회 (캐싱 적용)
  const refreshHearts = useCallback(async () => {
    if (!userId || !mountedRef.current) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // 캐시에서 먼저 확인
      const cached = getCachedHearts(userId);
      if (cached) {
        setHearts(cached.hearts);
        setLoading(false);
        return;
      }

      setLoading(true);
      // 캐시에 없으면 API 호출
      const heartData = await fetchHearts(userId);
      
      if (mountedRef.current) {
        setHearts(heartData.hearts);
      }
    } catch (err) {
      console.error('하트 조회 실패:', err);
      if (mountedRef.current) {
        // 하트 시스템이 준비되지 않은 경우 기본값으로 설정
        setHearts(100); // 임시로 100개 표시
        setError(null); // 에러 표시하지 않음
        console.warn('하트 시스템 준비 중 - 임시로 100개 표시');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
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
        if (mountedRef.current) {
          setHearts(newHearts);
          setCachedHearts(userId, { hearts: newHearts, lastUpdate: new Date().toISOString() });
          setError(null);
        }
        return true;
      } else {
        // 하트 부족 등의 에러
        if (mountedRef.current) {
          setError(data.error || '하트 사용에 실패했습니다.');
          
          // 하트 부족시 최신 하트 정보로 업데이트
          if (data.currentHearts !== undefined) {
            setHearts(data.currentHearts);
            setCachedHearts(userId, { hearts: data.currentHearts, lastUpdate: new Date().toISOString() });
          }
        }
        return false;
      }
    } catch (err) {
      console.error('하트 사용 실패:', err);
      if (mountedRef.current) {
        setError('네트워크 오류가 발생했습니다.');
      }
      return false;
    }
  }, [userId]);

  // 컴포넌트 마운트 상태 추적
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // userId 변경시에만 하트 정보 새로고침 (불필요한 재호출 방지)
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
    useHearts,
  };
}

// 캐시 정리 함수 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  heartCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION) {
      heartCache.delete(key);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    console.log(`🧹 하트 캐시 정리: ${deletedCount}개 항목 삭제`);
  }
}, 60000); // 1분마다 정리 