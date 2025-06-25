import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

interface Persona {
  id: string;
  name: string;
  avatar: string;
  gender?: string;
  age?: string;
  job?: string;
  info?: string;
  habit?: string;
  createdAt?: string;
}

interface UsePersonasReturn {
  personas: Persona[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  loadPersonas: () => Promise<void>;
  createPersona: (persona: Omit<Persona, 'id'>) => Promise<void>;
  updatePersona: (id: string, persona: Partial<Persona>) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// 페르소나 캐시
const CACHE_DURATION = 3 * 60 * 1000; // 3분
const cache = new Map<string, { data: Persona[]; timestamp: number }>();

const getCachedPersonas = (userId: string): Persona[] | null => {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(userId);
  return null;
};

const setCachePersonas = (userId: string, data: Persona[]) => {
  cache.set(userId, { data, timestamp: Date.now() });
};

export const usePersonas = (userId: string | null): UsePersonasReturn => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadPersonas = useCallback(async () => {
    if (!userId || userId === 'guest') {
      setPersonas([]);
      setHasLoaded(true);
      setLoading(false);
      return;
    }

    // 캐시 확인
    const cachedPersonas = getCachedPersonas(userId);
    if (cachedPersonas) {
      console.log('🚀 Personas 캐시 히트:', userId, `${cachedPersonas.length}개`);
      setPersonas(cachedPersonas);
      setHasLoaded(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      const response = await apiGet<{
        personas: Persona[];
        responseTime: number;
      }>(`/api/persona?userId=${userId}`);
      
      console.log('✅ Personas API 응답:', {
        userId,
        count: response.personas.length,
        loadTime: Date.now() - startTime
      });

      setPersonas(response.personas);
      setCachePersonas(userId, response.personas);
      setHasLoaded(true);
    } catch (err: any) {
      console.error('❌ Personas API 에러:', err);
      setError(err.message || '페르소나를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createPersona = useCallback(async (newPersona: Omit<Persona, 'id'>) => {
    if (!userId || userId === 'guest') {
      throw new Error('로그인이 필요합니다.');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<{ persona: Persona }>('/api/persona', {
        userId,
        ...newPersona
      });
      
      console.log('✅ Persona 생성 성공:', response.persona);
      
      // 로컬 상태 업데이트
      setPersonas(prev => [...prev, response.persona]);
      
      // 캐시 무효화
      cache.delete(userId);
    } catch (err: any) {
      console.error('❌ Persona 생성 에러:', err);
      setError(err.message || '페르소나 생성에 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updatePersona = useCallback(async (id: string, updatedPersona: Partial<Persona>) => {
    if (!userId || userId === 'guest') {
      throw new Error('로그인이 필요합니다.');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiPut<{ persona: Persona }>(`/api/persona/${id}`, updatedPersona);
      
      console.log('✅ Persona 수정 성공:', response.persona);
      
      // 로컬 상태 업데이트
      setPersonas(prev => 
        prev.map(p => p.id === id ? { ...p, ...updatedPersona } : p)
      );
      
      // 캐시 무효화
      cache.delete(userId);
    } catch (err: any) {
      console.error('❌ Persona 수정 에러:', err);
      setError(err.message || '페르소나 수정에 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const deletePersona = useCallback(async (id: string) => {
    if (!userId || userId === 'guest') {
      throw new Error('로그인이 필요합니다.');
    }

    setLoading(true);
    setError(null);

    try {
      await apiDelete(`/api/persona/${id}`);
      
      console.log('✅ Persona 삭제 성공:', id);
      
      // 로컬 상태 업데이트
      setPersonas(prev => prev.filter(p => p.id !== id));
      
      // 캐시 무효화
      cache.delete(userId);
    } catch (err: any) {
      console.error('❌ Persona 삭제 에러:', err);
      setError(err.message || '페르소나 삭제에 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    if (userId) {
      cache.delete(userId);
    }
    await loadPersonas();
  }, [loadPersonas, userId]);

  // 자동 로딩은 하지 않음 - 필요할 때만 호출
  useEffect(() => {
    // 빈 useEffect - 수동 로딩만 지원
  }, []);

  return {
    personas,
    loading,
    error,
    hasLoaded,
    loadPersonas,
    createPersona,
    updatePersona,
    deletePersona,
    refetch
  };
};

// 캐시 정리
export const clearPersonasCache = (userId?: string) => {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}; 