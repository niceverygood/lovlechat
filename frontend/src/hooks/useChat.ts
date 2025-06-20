import { useCallback, useEffect, useState, useRef } from "react";

export interface Msg {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
  createdAt: string;
  timestamp: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface Character {
  id: number;
  name: string;
  profileImg?: string;
  age?: number;
  job?: string;
  oneLiner?: string;
  background?: string;
  personality?: string;
  habit?: string;
  likes?: string;
  dislikes?: string;
  extraInfos?: any;
  gender?: string;
  scope?: string;
  roomCode?: string;
  category?: string;
  tags?: string[];
  attachments?: any;
  firstScene?: string;
  firstMessage?: string;
  backgroundImg?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// === 극도로 최적화된 설정 ===
const DEBOUNCE_DELAY = 50; // 50ms로 더 단축
const CACHE_TTL = 15000; // 15초로 단축 (더 빠른 업데이트)
const REQUEST_TIMEOUT = 5000; // 5초 타임아웃

// === 글로벌 캐시 및 요청 관리 ===
const globalCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

// === 캐시 헬퍼 함수들 ===
const getCacheKey = (url: string, params?: any): string => {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${url}:${paramStr}`;
};

const getCachedData = (key: string): any | null => {
  const cached = globalCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    globalCache.delete(key);
    return null;
  }
  
  return cached.data;
};

const setCachedData = (key: string, data: any): void => {
  // LRU 기반 캐시 크기 관리
  if (globalCache.size >= 50) {
    const firstKey = globalCache.keys().next().value;
    globalCache.delete(firstKey);
  }
  
  globalCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// === 공격적 디바운싱 함수 ===
const debounce = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number,
  key: string
): T => {
  return ((...args: any[]) => {
    return new Promise((resolve, reject) => {
      // 기존 타이머 취소
      const existingTimer = debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // 새 타이머 설정
      const timer = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          debounceTimers.delete(key);
        }
      }, delay);
      
      debounceTimers.set(key, timer);
    });
  }) as T;
};

// === 최적화된 fetch 함수 ===
const optimizedFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  const cacheKey = getCacheKey(url, options.body);
  
  // 1. 캐시 확인
  const cached = getCachedData(cacheKey);
  if (cached && options.method !== 'POST') {
    return cached;
  }
  
  // 2. 진행 중인 요청 확인
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }
  
  // 3. AbortController로 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  const requestPromise = fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }).then(async (response) => {
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // GET 요청만 캐시
    if (!options.method || options.method === 'GET') {
      setCachedData(cacheKey, data);
    }
    
    return data;
  }).catch((error) => {
    clearTimeout(timeoutId);
    
    // 네트워크 에러 시 캐시된 데이터 사용
    if (error.name === 'AbortError' || error.message.includes('fetch')) {
      const staleData = globalCache.get(cacheKey);
      if (staleData) {
        return staleData.data;
      }
    }
    
    throw error;
  });
  
  // 4. 요청 등록
  activeRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    activeRequests.delete(cacheKey);
  }
};

export function useChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const componentId = useRef(`chat_${Date.now()}_${Math.random()}`);
  const isUnmounted = useRef(false);

  // === 안전한 상태 업데이트 ===
  const safeSetState = useCallback((updater: () => void) => {
    if (!isUnmounted.current) {
      updater();
    }
  }, []);

  // 컴포넌트별 정리 함수 등록
  useEffect(() => {
    const id = componentId.current;
    safeSetState(() => setLoading(false));
    safeSetState(() => setError(null));
    
    return () => {
      isUnmounted.current = true;
      
      // 디바운스 타이머 정리
      for (const [key, timer] of Array.from(debounceTimers.entries())) {
        if (key.includes(id)) {
          clearTimeout(timer);
          debounceTimers.delete(key);
        }
      }
    };
  }, [safeSetState]);

  // === 디바운스된 메시지 로드 ===
  const loadMessages = useCallback(
    debounce(async (
      characterId: number,
      personaId: string
    ): Promise<Msg[]> => {
      if (isUnmounted.current) return [];
      
      safeSetState(() => setLoading(true));
      safeSetState(() => setError(null));
      
      try {
        const data = await optimizedFetch(
          `/api/chat/${characterId}?personaId=${personaId}`
        );
        
        if (!isUnmounted.current) {
          setMessages(data || []);
          setLoading(false);
        }
        
        return data || [];
      } catch (error: any) {
        if (!isUnmounted.current) {
          setError(error.message || 'Failed to load messages');
          setLoading(false);
        }
        throw error;
      }
    }, DEBOUNCE_DELAY, `loadMessages_${componentId.current}`),
    []
  );

  // === 캐릭터 정보 로드 ===
  const loadCharacter = useCallback(async (characterId: number): Promise<Character> => {
    return optimizedFetch(`/api/character/${characterId}`);
  }, []);
  
  // === 디바운스된 메시지 전송 ===
  const sendMessage = useCallback(
    debounce(async (characterId: number, personaId: string, message: string) => {
      if (isUnmounted.current) return null;
      
      safeSetState(() => setLoading(true));
      safeSetState(() => setError(null));
      
      try {
        const data = await optimizedFetch(`/api/chat/${characterId}`, {
          method: 'POST',
          body: JSON.stringify({ personaId, message })
        });
        
        if (!isUnmounted.current) {
          setMessages(data || []);
          setLoading(false);
        }
        
        return data;
      } catch (error: any) {
        if (!isUnmounted.current) {
          setError(error.message || 'Failed to send message');
          setLoading(false);
        }
        throw error;
      }
    }, DEBOUNCE_DELAY, `sendMessage-${componentId.current}`),
    []
  );
  
  // === 디바운스된 채팅 목록 로드 ===
  const loadChatList = useCallback(
    debounce(async (userId: string): Promise<Msg[]> => {
      if (isUnmounted.current) return [];
      
      safeSetState(() => setLoading(true));
      safeSetState(() => setError(null));
      
      try {
        const data = await optimizedFetch(`/api/chat/list?userId=${userId}`);
        return data || [];
      } catch (error: any) {
        if (!isUnmounted.current) {
          setError(error.message || 'Failed to load chat list');
          setLoading(false);
        }
        throw error;
      }
    }, DEBOUNCE_DELAY, `loadChatList-${componentId.current}`),
    []
  );

  // === 첫 만남 날짜 확인 ===
  const startFirstDate = useCallback(async (characterId: number, personaId: string): Promise<string> => {
    return optimizedFetch(
      `/api/chat/first-date?characterId=${characterId}&personaId=${personaId}`
    ).then(data => data.firstDate);
  }, []);

  // === 병렬 데이터 로드 (최적화) ===
  const loadChatData = useCallback(async (
    characterId: number,
    personaId: string,
    forceRefresh: boolean = false
  ): Promise<{
    messages: Msg[];
    character: Character;
    firstDate: string;
  }> => {
    if (isUnmounted.current) return { messages: [], character: {} as Character, firstDate: '' };
    
    safeSetState(() => setLoading(true));
    safeSetState(() => setError(null));
    
    try {
      // 강제 새로고침인 경우 캐시 무효화
      if (forceRefresh) {
        globalCache.delete(`messages_${characterId}_${personaId}`);
        globalCache.delete(`character_${characterId}`);
        globalCache.delete(`firstDate_${characterId}_${personaId}`);
      }
      
      // 병렬로 모든 데이터 로드
      const [messages, character, firstDate] = await Promise.allSettled([
        loadMessages(characterId, personaId),
        loadCharacter(characterId),
        startFirstDate(characterId, personaId)
      ]);
      
      return {
        messages: messages.status === 'fulfilled' ? messages.value : [],
        character: character.status === 'fulfilled' ? character.value : {} as Character,
        firstDate: firstDate.status === 'fulfilled' ? firstDate.value : ''
      };
    } catch (error: any) {
      if (!isUnmounted.current) {
        setError(error.message || 'Failed to load chat data');
        setLoading(false);
      }
      throw error;
    }
  }, [loadMessages, loadCharacter, startFirstDate, safeSetState, isUnmounted]);

  // === 캐시 관리 ===
  const clearCache = useCallback(() => {
    globalCache.clear();
    activeRequests.clear();
    
    // 디바운스 타이머 정리
    for (const [key, timer] of Array.from(debounceTimers.entries())) {
      if (key.includes(componentId.current)) {
        clearTimeout(timer);
        debounceTimers.delete(key);
      }
    }
    
    console.log('🧹 Chat cache cleared');
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      cacheSize: globalCache.size,
      activeRequests: activeRequests.size,
      maxCacheSize: 50,
      requestControllers: 0
    };
  }, []);

  return {
    messages,
    setMessages,
    loading,
    error,
    setError,
    loadMessages,
    loadCharacter,
    sendMessage,
    loadChatList,
    startFirstDate,
    loadChatData,
    clearCache,
    getCacheStats
  };
}

export default useChat;
