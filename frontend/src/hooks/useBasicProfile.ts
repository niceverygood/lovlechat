import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

interface BasicProfile {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  hearts: number;
  createdAt: string;
}

interface UseBasicProfileReturn {
  profile: BasicProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// 기본 프로필 캐시 (더 짧은 캐시 시간)
const CACHE_DURATION = 2 * 60 * 1000; // 2분
const cache = new Map<string, { data: BasicProfile; timestamp: number }>();

const getCachedProfile = (userId: string): BasicProfile | null => {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(userId);
  return null;
};

const setCacheProfile = (userId: string, data: BasicProfile) => {
  cache.set(userId, { data, timestamp: Date.now() });
};

export const useBasicProfile = (userId: string | null): UseBasicProfileReturn => {
  const [profile, setProfile] = useState<BasicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId || userId === 'guest') {
      setProfile({
        userId: 'guest',
        name: '게스트',
        hearts: 0,
        createdAt: new Date().toISOString()
      });
      setLoading(false);
      return;
    }

    // 캐시 확인
    const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
      console.log('🚀 BasicProfile 캐시 히트:', userId);
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      const response = await apiGet<{
        user: any;
        hearts: number;
        responseTime: number;
      }>(`/api/myinfo/basic?userId=${userId}`);
      
      const basicProfile: BasicProfile = {
        userId: response.user.userId,
        name: response.user.name || '사용자',
        email: response.user.email,
        avatar: response.user.avatar,
        hearts: response.hearts,
        createdAt: response.user.createdAt
      };

      console.log('✅ BasicProfile API 응답:', {
        userId,
        name: basicProfile.name,
        hearts: basicProfile.hearts,
        loadTime: Date.now() - startTime
      });

      setProfile(basicProfile);
      setCacheProfile(userId, basicProfile);
    } catch (err: any) {
      console.error('❌ BasicProfile API 에러:', err);
      setError(err.message || '프로필 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    if (userId) {
      cache.delete(userId);
    }
    await fetchProfile();
  }, [fetchProfile, userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch
  };
};

// 캐시 정리
export const clearBasicProfileCache = (userId?: string) => {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}; 