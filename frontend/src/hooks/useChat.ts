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

// 통합 캐시 시스템 (더욱 최적화)
const chatCache = new Map<string, CacheEntry<any>>();
const MAX_CACHE_SIZE = 30;
const DEFAULT_TTL = 60000; // 1분 (더 빠른 업데이트)

// 진행 중인 요청 추적
const activeRequests = new Map<string, Promise<any>>();

// 컴포넌트별 정리 추적
const componentCleanupCallbacks = new Map<string, (() => void)[]>();

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
  }, 2 * 60 * 1000); // 2분마다 정리
}

// 캐시 정리 시작
startCacheCleanup();

// 안전한 fetch 함수 (타임아웃 포함)
async function safeFetch<T>(
  url: string, 
  options?: RequestInit,
  timeout: number = 12000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
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
        throw new Error('Request timeout');
      }
      throw error;
    }
    throw new Error('Unknown fetch error');
  }
}

// 캐시된 요청 함수
async function cachedRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
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
      // 에러 시 stale cache 사용
      if (cached) {
        console.warn('Using stale cache due to error:', error.message);
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

  // 컴포넌트별 정리 함수 등록
  useEffect(() => {
    const id = componentId.current;
    componentCleanupCallbacks.set(id, []);
    
    return () => {
      // 컴포넌트 언마운트 시 정리
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

  // 메시지 로드 (최적화)
  const loadMessages = useCallback(async (
    characterId: number,
    personaId: string
  ): Promise<Msg[]> => {
    const cacheKey = `messages_${characterId}_${personaId}`;
    
    return cachedRequest(cacheKey, async () => {
      const response = await safeFetch<{messages: Msg[]}>(
        `/api/chat/${characterId}?personaId=${personaId}`
      );
      return response.messages || [];
    });
  }, []);

  // 캐릭터 정보 로드 (최적화)
  const loadCharacter = useCallback(async (characterId: number): Promise<Character> => {
    const cacheKey = `character_${characterId}`;
    
    return cachedRequest(cacheKey, async () => {
      return safeFetch<Character>(`/api/character/${characterId}`);
    }, 5 * 60 * 1000); // 5분 캐시
  }, []);

  // 메시지 전송 (최적화)
  const sendMessage = useCallback(async (
    characterId: number,
    personaId: string,
    message: string
  ): Promise<Msg | null> => {
    if (!message.trim()) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await safeFetch<{newMessage: Msg}>(`/api/chat/${characterId}`, {
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
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // 채팅 목록 로드 (최적화)
  const loadChatList = useCallback(async (userId: string) => {
    const cacheKey = `chatList_${userId}`;
    
    return cachedRequest(cacheKey, async () => {
      return safeFetch<any[]>(`/api/chat/list?userId=${userId}`);
    });
  }, []);

  // 첫 대화 시작 (최적화)
  const startFirstDate = useCallback(async (
    characterId: number,
    personaId: string
  ): Promise<string> => {
    const cacheKey = `firstDate_${characterId}_${personaId}`;
    
    return cachedRequest(cacheKey, async () => {
      const response = await safeFetch<{firstDate: string}>(
        `/api/chat/first-date?characterId=${characterId}&personaId=${personaId}`
      );
      return response.firstDate;
    });
  }, []);

  // 병렬 데이터 로드 (최적화)
  const loadChatData = useCallback(async (
    characterId: number,
    personaId: string
  ): Promise<{
    messages: Msg[];
    character: Character;
    firstDate: string;
  }> => {
    try {
      setLoading(true);
      setError(null);
      
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
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadCharacter, startFirstDate]);

  // 캐시 관리
  const clearCache = useCallback(() => {
    chatCache.clear();
    activeRequests.clear();
    console.log('🧹 Chat cache cleared');
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      cacheSize: chatCache.size,
      activeRequests: activeRequests.size,
      maxCacheSize: MAX_CACHE_SIZE
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
