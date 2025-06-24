import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

interface User {
  userId: string;
  name: string;
  createdAt: string;
}

interface Persona {
  id: string;
  name: string;
  avatar: string;
  gender?: string;
  age?: string;
  job?: string;
  info?: string;
  habit?: string;
}

interface MyInfoStats {
  totalChats: number;
  activeCharacters: number;
  totalMessages: number;
  avgFavor: number;
  maxFavor?: number;
  totalFavors?: number;
  heartsUsed?: number;
  heartsEarned?: number;
  totalTransactions?: number;
  lastActivity?: string;
}

interface MyInfoData {
  user: User;
  personas: Persona[];
  hearts: number;
  responseTime: number;
}

interface UseMyInfoReturn {
  data: MyInfoData | null;
  stats: MyInfoStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

// 캐시 관리
const CACHE_DURATION = 5 * 60 * 1000; // 5분
const cache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCacheData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const useMyInfo = (userId: string | null): UseMyInfoReturn => {
  const [data, setData] = useState<MyInfoData | null>(null);
  const [stats, setStats] = useState<MyInfoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyInfo = useCallback(async () => {
    if (!userId || userId === 'guest') {
      setData({
        user: { userId: 'guest', name: '게스트', createdAt: new Date().toISOString() },
        personas: [],
        hearts: 0,
        responseTime: 0
      });
      setLoading(false);
      return;
    }

    const cacheKey = `myinfo_${userId}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('🚀 MyInfo 캐시 데이터 사용:', cacheKey);
      setData(cachedData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      const response = await apiGet<MyInfoData>(`/api/myinfo?userId=${userId}`);
      
      console.log('✅ MyInfo API 응답:', {
        userId,
        personas: response.personas?.length || 0,
        hearts: response.hearts,
        responseTime: response.responseTime,
        loadTime: Date.now() - startTime
      });

      setData(response);
      setCacheData(cacheKey, response);
    } catch (err: any) {
      console.error('❌ MyInfo API 에러:', err);
      setError(err.message || '사용자 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchStats = useCallback(async () => {
    if (!userId || userId === 'guest') {
      setStats({
        totalChats: 0,
        activeCharacters: 0,
        totalMessages: 0,
        avgFavor: 0
      });
      return;
    }

    const cacheKey = `myinfo_stats_${userId}`;
    const cachedStats = getCachedData(cacheKey);
    
    if (cachedStats) {
      console.log('🚀 MyInfo Stats 캐시 데이터 사용:', cacheKey);
      setStats(cachedStats);
      return;
    }

    try {
      const response = await apiGet<{ stats: MyInfoStats }>(`/api/myinfo/stats?userId=${userId}`);
      
      console.log('✅ MyInfo Stats API 응답:', response.stats);
      
      setStats(response.stats);
      setCacheData(cacheKey, response.stats);
    } catch (err: any) {
      console.error('❌ MyInfo Stats API 에러:', err);
      // 통계는 선택적이므로 에러를 무시하고 기본값 설정
      setStats({
        totalChats: 0,
        activeCharacters: 0,
        totalMessages: 0,
        avgFavor: 0
      });
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    // 캐시 무효화
    if (userId) {
      cache.delete(`myinfo_${userId}`);
    }
    await fetchMyInfo();
  }, [fetchMyInfo, userId]);

  const refreshStats = useCallback(async () => {
    // 통계 캐시 무효화
    if (userId) {
      cache.delete(`myinfo_stats_${userId}`);
    }
    await fetchStats();
  }, [fetchStats, userId]);

  useEffect(() => {
    fetchMyInfo();
  }, [fetchMyInfo]);

  // 통계는 별도로 lazy loading
  useEffect(() => {
    if (data && userId && userId !== 'guest') {
      fetchStats();
    }
  }, [data, fetchStats, userId]);

  return {
    data,
    stats,
    loading,
    error,
    refetch,
    refreshStats
  };
};

// 캐시 정리 함수 (메모리 최적화)
export const clearMyInfoCache = (userId?: string) => {
  if (userId) {
    cache.delete(`myinfo_${userId}`);
    cache.delete(`myinfo_stats_${userId}`);
  } else {
    cache.clear();
  }
};

// 캐시 상태 확인 함수 (디버깅용)
export const getMyInfoCacheInfo = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    data: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      isExpired: Date.now() - value.timestamp > CACHE_DURATION
    }))
  };
}; 