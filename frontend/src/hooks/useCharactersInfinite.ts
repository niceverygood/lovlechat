import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiDelete } from '../lib/api';

interface Character {
  id: number;
  profileImg?: string | null;
  name?: string;
  tags?: string[] | string;
  selectedTags?: string[];
  category?: string;
  gender?: string;
  scope?: string;
  age?: string | number;
  job?: string;
  oneLiner?: string;
  background?: string;
  personality?: string;
  habit?: string;
  like?: string;
  dislike?: string;
  extraInfos?: string[];
  firstScene?: string;
  firstMessage?: string;
  backgroundImg?: string | null;
  createdAt?: string;
}

interface CharactersPage {
  characters: Character[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface UseCharactersInfiniteReturn {
  characters: Character[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  hasMore: boolean;
  total: number;
  loadCharacters: () => Promise<void>;
  loadMore: () => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  isLoadingMore: boolean;
}

const CHARACTERS_PER_PAGE = 10;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 페이지별 캐시
const pageCache = new Map<string, { data: CharactersPage; timestamp: number }>();

const getCachedPage = (userId: string, page: number): CharactersPage | null => {
  const cacheKey = `${userId}_page_${page}`;
  const cached = pageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  pageCache.delete(cacheKey);
  return null;
};

const setCachedPage = (userId: string, page: number, data: CharactersPage) => {
  const cacheKey = `${userId}_page_${page}`;
  pageCache.set(cacheKey, { data, timestamp: Date.now() });
};

const clearUserPageCache = (userId: string) => {
  const keysToDelete = Array.from(pageCache.keys()).filter(key => key.startsWith(`${userId}_page_`));
  keysToDelete.forEach(key => pageCache.delete(key));
};

export const useCharactersInfinite = (userId: string | null): UseCharactersInfiniteReturn => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  
  // 중복 요청 방지를 위한 ref
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(async (page: number, append: boolean = false) => {
    if (!userId || userId === 'guest') {
      setCharacters([]);
      setHasLoaded(true);
      setHasMore(false);
      setTotal(0);
      setLoading(false);
      setIsLoadingMore(false);
      return;
    }

    // 캐시 확인
    const cachedPage = getCachedPage(userId, page);
    if (cachedPage) {
      console.log('🚀 Characters 페이지 캐시 히트:', userId, `page ${page}`, `${cachedPage.characters.length}개`);
      
      if (append) {
        setCharacters(prev => [...prev, ...cachedPage.characters]);
      } else {
        setCharacters(cachedPage.characters);
      }
      
      setTotal(cachedPage.total);
      setHasMore(cachedPage.hasMore);
      setCurrentPage(page);
      setHasLoaded(true);
      setLoading(false);
      setIsLoadingMore(false);
      return;
    }

    // 로딩 상태 설정
    if (append) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const startTime = Date.now();
      const response = await apiGet<CharactersPage>(`/api/character/user/${userId}?page=${page}&limit=${CHARACTERS_PER_PAGE}`);
      
      console.log('✅ Characters API 응답:', {
        userId,
        page,
        count: response.characters.length,
        total: response.total,
        hasMore: response.hasMore,
        loadTime: Date.now() - startTime
      });

      // 캐시에 저장
      setCachedPage(userId, page, response);

      if (append) {
        setCharacters(prev => [...prev, ...response.characters]);
      } else {
        setCharacters(response.characters);
      }
      
      setTotal(response.total);
      setHasMore(response.hasMore);
      setCurrentPage(page);
      setHasLoaded(true);
    } catch (err: any) {
      console.error('❌ Characters API 에러:', err);
      setError(err.message || '캐릭터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
      loadingMoreRef.current = false;
    }
  }, [userId]);

  const loadCharacters = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    setCurrentPage(0);
    setCharacters([]);
    setHasMore(true);
    await loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    
    const nextPage = currentPage + 1;
    await loadPage(nextPage, true);
  }, [hasMore, currentPage, loadPage, loading]);

  const deleteCharacter = useCallback(async (characterId: number) => {
    if (!userId || userId === 'guest') {
      throw new Error('로그인이 필요합니다.');
    }

    try {
      await apiDelete(`/api/character/${characterId}?userId=${userId}`);
      
      console.log('✅ Character 삭제 성공:', characterId);
      
      // 로컬 상태에서 제거
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      setTotal(prev => prev - 1);
      
      // 캐시 무효화
      clearUserPageCache(userId);
    } catch (err: any) {
      console.error('❌ Character 삭제 에러:', err);
      throw new Error(err.message || '캐릭터 삭제에 실패했습니다.');
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (userId) {
      clearUserPageCache(userId);
    }
    await loadCharacters();
  }, [loadCharacters, userId]);

  // 자동 로딩은 하지 않음 - 필요할 때만 호출
  useEffect(() => {
    // 빈 useEffect - 수동 로딩만 지원
  }, []);

  return {
    characters,
    loading,
    error,
    hasLoaded,
    hasMore,
    total,
    loadCharacters,
    loadMore,
    deleteCharacter,
    refresh,
    isLoadingMore
  };
};

// 캐시 정리
export const clearCharactersCache = (userId?: string) => {
  if (userId) {
    clearUserPageCache(userId);
  } else {
    pageCache.clear();
  }
}; 