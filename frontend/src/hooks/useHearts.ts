import { useState, useEffect, useRef, useCallback } from 'react';
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
  useHearts: (amount: number, description?: string, relatedId?: string) => Promise<boolean>;
}

// 🔥 프로덕션 환경에서 극도로 강력한 캐싱 적용
const isProduction = process.env.NODE_ENV === 'production';
const heartCache = new Map<string, { data: HeartData; timestamp: number }>();
const pendingRequests = new Map<string, Promise<HeartData>>();
const lastCallTime = new Map<string, number>();

// 환경별 캐싱 설정 (프로덕션에서는 훨씬 긴 캐시)
const CACHE_DURATION = isProduction ? 300000 : 60000; // 프로덕션: 5분, 로컬: 1분
const MIN_CALL_INTERVAL = isProduction ? 10000 : 3000; // 프로덕션: 10초, 로컬: 3초
const MAX_REQUESTS_PER_MINUTE = isProduction ? 3 : 10; // 프로덕션: 분당 3회, 로컬: 10회

// 분당 요청 수 추적
const requestCounts = new Map<string, { count: number; windowStart: number }>();

// 컴포넌트 마운트 상태 추적
const mountedComponents = new Set<string>();

// 🛡️ 분당 요청 수 제한 검사
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const key = userId || 'anonymous';
  const current = requestCounts.get(key) || { count: 0, windowStart: now };
  
  // 1분 윈도우 리셋
  if (now - current.windowStart > 60000) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  // 요청 수 증가
  current.count++;
  requestCounts.set(key, current);
  
  if (current.count > MAX_REQUESTS_PER_MINUTE) {
    console.warn(`🚫 하트 API 분당 요청 제한 초과: ${current.count}/${MAX_REQUESTS_PER_MINUTE}`);
    return true;
  }
  
  return false;
}

// 캐시에서 하트 데이터 조회
function getCachedHearts(userId: string): HeartData | null {
  if (!userId) return null;
  
  const cached = heartCache.get(userId);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    heartCache.delete(userId);
    return null;
  }
  
  console.log(`💾 하트 캐시 히트 (${Math.round((CACHE_DURATION - (now - cached.timestamp)) / 1000)}초 남음):`, cached.data.hearts);
  return cached.data;
}

// 캐시에 하트 데이터 저장
function setCachedHearts(userId: string, data: HeartData): void {
  if (!userId) return;
  
  heartCache.set(userId, {
    data,
    timestamp: Date.now()
  });
  
  console.log(`💾 하트 캐시 저장:`, data.hearts);
}

// 실제 하트 API 호출
async function fetchHearts(userId: string): Promise<HeartData> {
  const url = `${API_BASE_URL}/api/hearts?userId=${userId}`;
  
  console.log(`🔄 하트 API 호출 시작: ${userId}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`하트 조회 실패: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || '하트 조회 실패');
  }
  
  const heartData: HeartData = {
    hearts: data.hearts || 0,
    lastUpdate: data.lastUpdate || new Date().toISOString()
  };
  
  console.log(`✅ 하트 API 응답:`, heartData.hearts);
  
  // 캐시에 저장
  setCachedHearts(userId, heartData);
  
  return heartData;
}

export function useHearts(userId: string | null): UseHeartsReturn {
  const [hearts, setHearts] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const componentId = useRef<string>(`hearts-${Math.random().toString(36).substr(2, 9)}`);
  const initialLoadDone = useRef<boolean>(false);

  // 🛡️ 호출 제한 검사
  const canMakeRequest = useCallback((userId: string | null): boolean => {
    if (!userId) return false;
    
    // 분당 요청 수 제한
    if (isRateLimited(userId)) {
      return false;
    }
    
    // 최소 호출 간격 제한
    const lastCall = lastCallTime.get(userId);
    const now = Date.now();
    
    if (lastCall && (now - lastCall) < MIN_CALL_INTERVAL) {
      const remaining = Math.ceil((MIN_CALL_INTERVAL - (now - lastCall)) / 1000);
      console.log(`⏰ 하트 API 호출 대기 중: ${remaining}초 남음`);
      return false;
    }
    
    return true;
  }, []);

  // 하트 조회 함수 (강력한 캐싱 및 중복 방지)
  const fetchHeartsData = useCallback(async (userId: string): Promise<void> => {
    // 캐시 확인
    const cached = getCachedHearts(userId);
    if (cached) {
      setHearts(cached.hearts);
      setError(null);
      return;
    }
    
    // 호출 제한 검사
    if (!canMakeRequest(userId)) {
      return;
    }
    
    // 중복 요청 방지
    const pendingKey = userId;
    if (pendingRequests.has(pendingKey)) {
      console.log(`⏳ 하트 API 중복 요청 방지: ${userId}`);
      try {
        const data = await pendingRequests.get(pendingKey)!;
        setHearts(data.hearts);
        setError(null);
      } catch (err) {
        console.error('대기 중인 하트 요청 실패:', err);
      }
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const promise = fetchHearts(userId);
    pendingRequests.set(pendingKey, promise);
    lastCallTime.set(userId, Date.now());
    
    try {
      const data = await promise;
      
      // 컴포넌트가 아직 마운트되어 있는지 확인
      if (mountedComponents.has(componentId.current)) {
        setHearts(data.hearts);
        setError(null);
      }
    } catch (err) {
      console.error('하트 조회 실패:', err);
      if (mountedComponents.has(componentId.current)) {
        setError(err instanceof Error ? err.message : '하트 조회 실패');
      }
    } finally {
      pendingRequests.delete(pendingKey);
      if (mountedComponents.has(componentId.current)) {
        setLoading(false);
      }
    }
  }, [canMakeRequest]);

  // 하트 새로고침
  const refreshHearts = useCallback(async (): Promise<void> => {
    if (!userId) return;
    
    // 강제 새로고침을 위해 캐시 삭제
    heartCache.delete(userId);
    await fetchHeartsData(userId);
  }, [userId, fetchHeartsData]);

  // 하트 사용
  const useHearts = useCallback(async (
    amount: number, 
    description?: string, 
    relatedId?: string
  ): Promise<boolean> => {
    if (!userId) return false;
    
    // 호출 제한 검사
    if (!canMakeRequest(userId)) {
      console.warn('하트 사용 API 호출 제한으로 인해 거부됨');
      return false;
    }
    
    // 하트 차감 로그
    if (amount < 0) {
      console.log(`[하트 차감] userId: ${userId}, amount: ${amount}, before: ${hearts}`);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/hearts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amount: -Math.abs(amount), // 음수로 변환
          description: description || `하트 사용 (${amount}개)`,
          relatedId
        }),
      });

      if (!response.ok) {
        throw new Error(`하트 사용 실패: ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '하트 사용 실패');
      }

      // 캐시 업데이트
      const newHeartData: HeartData = {
        hearts: data.newHearts || hearts - amount,
        lastUpdate: new Date().toISOString()
      };
      
      setCachedHearts(userId, newHeartData);
      setHearts(newHeartData.hearts);
      
      console.log(`💖 하트 사용 완료: -${amount} (잔여: ${newHeartData.hearts})`);
      
      return true;
    } catch (err) {
      console.error('하트 사용 실패:', err);
      setError(err instanceof Error ? err.message : '하트 사용 실패');
      return false;
    }
  }, [userId, hearts, canMakeRequest]);

  // 컴포넌트 마운트/언마운트 추적
  useEffect(() => {
    const id = componentId.current;
    mountedComponents.add(id);
    
    return () => {
      mountedComponents.delete(id);
    };
  }, []);

  // 초기 하트 로딩 (한 번만)
  useEffect(() => {
    if (userId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchHeartsData(userId);
    }
  }, [userId, fetchHeartsData]);

  return {
    hearts,
    loading,
    error,
    refreshHearts,
    useHearts
  };
}

// 캐시 정리 함수 (메모리 누수 방지) - 더 긴 간격으로 실행
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  heartCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION) {
      heartCache.delete(key);
      deletedCount++;
    }
  });
  
  // 분당 요청 수 카운터도 정리
  requestCounts.forEach((value, key) => {
    if (now - value.windowStart > 60000) {
      requestCounts.delete(key);
    }
  });
  
  if (deletedCount > 0) {
    console.log(`🧹 하트 캐시 정리: ${deletedCount}개 항목 삭제`);
  }
}, isProduction ? 300000 : 60000); // 프로덕션: 5분마다, 로컬: 1분마다 