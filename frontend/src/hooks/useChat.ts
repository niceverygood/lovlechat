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

// === 최적화된 설정 ===
const chatCache = new Map<string, CacheEntry<any>>();
const MAX_CACHE_SIZE = 20; // 캐시 크기 축소
const DEFAULT_TTL = 30000; // 30초로 단축 (빠른 업데이트)
const REQUEST_TIMEOUT = 10000; // 10초 타임아웃

// 진행 중인 요청 추적 및 취소
const activeRequests = new Map<string, Promise<any>>();
const requestControllers = new Map<string, AbortController>();

// 컴포넌트별 정리 추적
const componentCleanupCallbacks = new Map<string, (() => void)[]>();

// 디바운스 맵
const debounceTimers = new Map<string, NodeJS.Timeout>();

// 캐시 정리 인터벌
let cacheCleanupInterval: NodeJS.Timeout | null = null;

function startCacheCleanup() {
  if (cacheCleanupInterval) return;
  
  cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    // 만료된 항목 제거
    const entries = Array.from(chatCache.entries());
    for (const [key, value] of entries) {
      if (now - value.timestamp > value.ttl) {
        chatCache.delete(key);
        cleaned++;
      }
    }
    
    // LRU 기반 크기 제한
    if (chatCache.size > MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(chatCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = chatCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        chatCache.delete(sortedEntries[i][0]);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Chat cache cleaned: ${cleaned} items`);
    }
  }, 60 * 1000); // 1분마다 정리
}

// 캐시 정리 시작
startCacheCleanup();

// === 디바운스 함수 ===
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  key: string
): T {
  return ((...args: any[]) => {
    // 기존 타이머 제거
    const existingTimer = debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // 새 타이머 설정
    const timer = setTimeout(() => {
      func(...args);
      debounceTimers.delete(key);
    }, delay);
    
    debounceTimers.set(key, timer);
  }) as T;
}

// === 최적화된 fetch 함수 ===
async function optimizedFetch<T>(
  url: string, 
  options?: RequestInit,
  timeout: number = REQUEST_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // 요청 컨트롤러 저장
  requestControllers.set(url, controller);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout or cancelled');
      }
      throw error;
    }
    throw new Error('Unknown fetch error');
  } finally {
    // 정리
    requestControllers.delete(url);
  }
}

// === 최적화된 캐시 요청 함수 ===
async function cachedRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
  skipCache: boolean = false
): Promise<T> {
  // 캐시 스킵 옵션
  if (skipCache) {
    return requestFn();
  }
  
  // 진행 중인 요청 확인
  if (activeRequests.has(key)) {
    return activeRequests.get(key) as Promise<T>;
  }
  
  // 캐시 확인
  const cached = chatCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached.data;
  }
  
  // 새로운 요청 생성
  const requestPromise = requestFn()
    .then((data) => {
      // 캐시 저장
      chatCache.set(key, {
        data,
        timestamp: now,
        ttl
      });
      return data;
    })
    .catch((error) => {
      // 에러 시 stale cache 사용 (더 오래된 캐시도 허용)
      if (cached) {
        console.warn('🔄 Using stale cache due to error:', error.message);
        return cached.data;
      }
      throw error;
    })
    .finally(() => {
      // 요청 완료 후 정리
      activeRequests.delete(key);
    });
  
  activeRequests.set(key, requestPromise);
  return requestPromise;
}

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
    componentCleanupCallbacks.set(id, []);
    
    return () => {
      isUnmounted.current = true;
      
      // 진행 중인 요청 취소
      for (const [url, controller] of Array.from(requestControllers.entries())) {
        if (url.includes(id)) {
          controller.abort();
          requestControllers.delete(url);
        }
      }
      
      // 디바운스 타이머 정리
      for (const [key, timer] of Array.from(debounceTimers.entries())) {
        if (key.includes(id)) {
          clearTimeout(timer);
          debounceTimers.delete(key);
        }
      }
      
      // 컴포넌트별 정리
      const cleanupFns = componentCleanupCallbacks.get(id) || [];
      cleanupFns.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      });
      componentCleanupCallbacks.delete(id);
    };
  }, []);

  // === 디바운스된 메시지 로드 ===
  const loadMessages = useCallback(
    debounce(async (
      characterId: number,
      personaId: string
    ): Promise<Msg[]> => {
      const cacheKey = `messages_${characterId}_${personaId}`;
      
      try {
        return await cachedRequest(cacheKey, async () => {
          const response = await optimizedFetch<{messages: Msg[]}>(
            `/api/chat/${characterId}?personaId=${personaId}`
          );
          return response.messages || [];
        });
      } catch (error) {
        console.error('💬 메시지 로드 실패:', error);
        throw error;
      }
    }, 100, `loadMessages_${componentId.current}`),
    []
  );

  // === 캐릭터 정보 로드 (긴 캐시) ===
  const loadCharacter = useCallback(async (characterId: number): Promise<Character> => {
    const cacheKey = `character_${characterId}`;
    
    return cachedRequest(cacheKey, async () => {
      return optimizedFetch<Character>(`/api/character/${characterId}`);
    }, 3 * 60 * 1000); // 3분 캐시 (캐릭터 정보는 변경이 적음)
  }, []);

  // === 메시지 전송 (최적화) ===
  const sendMessage = useCallback(async (
    characterId: number,
    personaId: string,
    message: string
  ): Promise<Msg | null> => {
    if (!message.trim() || loading) return null;
    
    safeSetState(() => setLoading(true));
    safeSetState(() => setError(null));
    
    try {
      const response = await optimizedFetch<{newMessage: Msg}>(`/api/chat/${characterId}`, {
        method: 'POST',
        body: JSON.stringify({
          personaId,
          message: message.trim()
        })
      });
      
      // 캐시 무효화 (메시지 업데이트)
      const messagesCacheKey = `messages_${characterId}_${personaId}`;
      chatCache.delete(messagesCacheKey);
      
      return response.newMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      safeSetState(() => setError(errorMessage));
      throw error;
    } finally {
      safeSetState(() => setLoading(false));
    }
  }, [loading, safeSetState]);

  // === 채팅 목록 로드 (디바운스) ===
  const loadChatList = useCallback(
    debounce(async (userId: string) => {
      const cacheKey = `chatList_${userId}`;
      
      return cachedRequest(cacheKey, async () => {
        return optimizedFetch<any[]>(`/api/chat/list?userId=${userId}`);
      });
    }, 150, `loadChatList_${componentId.current}`),
    []
  );

  // === 첫 대화 시작 ===
  const startFirstDate = useCallback(async (
    characterId: number,
    personaId: string
  ): Promise<string> => {
    const cacheKey = `firstDate_${characterId}_${personaId}`;
    
    return cachedRequest(cacheKey, async () => {
      const response = await optimizedFetch<{firstDate: string}>(
        `/api/chat/first-date?characterId=${characterId}&personaId=${personaId}`
      );
      return response.firstDate;
    });
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
    try {
      safeSetState(() => setLoading(true));
      safeSetState(() => setError(null));
      
      // 강제 새로고침인 경우 캐시 무효화
      if (forceRefresh) {
        chatCache.delete(`messages_${characterId}_${personaId}`);
        chatCache.delete(`character_${characterId}`);
        chatCache.delete(`firstDate_${characterId}_${personaId}`);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat data';
      safeSetState(() => setError(errorMessage));
      throw error;
    } finally {
      safeSetState(() => setLoading(false));
    }
  }, [loadMessages, loadCharacter, startFirstDate, safeSetState]);

  // === 캐시 관리 ===
  const clearCache = useCallback(() => {
    chatCache.clear();
    activeRequests.clear();
    
    // 진행 중인 요청 모두 취소
    for (const controller of Array.from(requestControllers.values())) {
      controller.abort();
    }
    requestControllers.clear();
    
    console.log('🧹 Chat cache cleared');
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      cacheSize: chatCache.size,
      activeRequests: activeRequests.size,
      maxCacheSize: MAX_CACHE_SIZE,
      requestControllers: requestControllers.size
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
