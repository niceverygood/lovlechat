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

interface FirstDateInfo {
  firstDate: string | null;
}

interface ChatMessage {
  id: number;
  message: string;
  sender: 'user' | 'ai';
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
  createdAt: string;
  timestamp: string;
}

interface ChatResponse {
  messages: ChatMessage[];
  favor: number;
  pagination?: Pagination;
}

// 완전 최적화된 메모리 캐싱
const chatCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 90 * 1000; // 90초로 단축
const MAX_CACHE_SIZE = 30; // 캐시 크기 제한

// 요청 중복 방지
const activeRequests = new Map<string, Promise<any>>();

// 캐시 정리 (메모리 누수 방지)
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
      console.log(`🧹 Chat cache cleaned: ${cleaned} entries`);
    }
  }, 60000); // 1분마다
}

// 초기화
startCacheCleanup();

function createCacheKey(url: string, params?: Record<string, any>): string {
  const paramStr = params ? new URLSearchParams(params).toString() : '';
  return `${url}${paramStr ? '?' + paramStr : ''}`;
}

// 최적화된 fetch (타임아웃 및 에러 처리 개선)
async function optimizedFetch<T>(
  url: string, 
  options?: RequestInit, 
  ttl: number = CACHE_TTL,
  useCache: boolean = true
): Promise<T> {
  const cacheKey = createCacheKey(url);
  const now = Date.now();
  
  // 캐시 확인
  if (useCache) {
    const cached = chatCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data;
    }
  }
  
  // 진행 중인 요청 확인
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }
  
  // AbortController로 타임아웃 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
  
  const requestPromise = fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  }).then(async (response) => {
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 캐시 저장
    if (useCache && data) {
      chatCache.set(cacheKey, {
        data,
        timestamp: now,
        ttl
      });
    }
    
    return data;
  }).catch((error) => {
    clearTimeout(timeoutId);
    
    // 네트워크 에러 시 캐시된 데이터 사용
    if (useCache) {
      const cached = chatCache.get(cacheKey);
      if (cached) {
        console.warn('Using cached data due to network error');
        return cached.data;
      }
    }
    
    throw error;
  }).finally(() => {
    activeRequests.delete(cacheKey);
  });
  
  activeRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export function useChat(
  characterId: string | null, 
  personaId: string | null
) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [favor, setFavor] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [backgroundImageUrl] = useState<string>('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getApiUrl = useCallback(() => {
    return process.env.REACT_APP_API_URL || 
           (process.env.NODE_ENV === 'production' 
             ? 'https://lovlechat-backend.vercel.app' 
             : 'http://localhost:3002');
  }, []);

  // 완전 최적화된 메시지 로딩
  const loadMessages = useCallback(async () => {
    if (!characterId || !personaId) {
      setMessages([]);
      setFavor(0);
      setHasLoaded(false);
      return;
    }
    
    const currentParams = `${characterId}-${personaId}`;
    
    // 중복 요청 완전 차단
    if (loadingRef.current || lastParamsRef.current === currentParams) {
      return;
    }

    // 기존 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    loadingRef.current = true;
    lastParamsRef.current = currentParams;
    setLoading(true);
    clearError();

    try {
      const API_BASE = getApiUrl();
      
      const response = await optimizedFetch<ChatResponse>(
        `${API_BASE}/api/chat/${characterId}?personaId=${personaId}`,
        { signal: abortControllerRef.current.signal },
        CACHE_TTL,
        true
      );

      if (response?.messages) {
        // 메시지 변환 최적화
        const transformedMessages: Msg[] = response.messages.map((msg: ChatMessage) => ({
          id: msg.id,
          text: msg.message || '',
          sender: msg.sender as 'user' | 'ai',
          characterName: msg.characterName || '',
          characterProfileImg: msg.characterProfileImg || '',
          characterAge: msg.characterAge || 0,
          characterJob: msg.characterJob || '',
          createdAt: msg.createdAt,
          timestamp: msg.timestamp
        }));

        setMessages(transformedMessages);
        setFavor(response.favor || 0);
        setPagination(response.pagination || null);
        setHasLoaded(true);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('메시지 로딩 에러:', err);
        setError(err.message || '메시지를 불러올 수 없습니다.');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [characterId, personaId, clearError, getApiUrl]);

  // 최적화된 메시지 전송
  const sendMessage = useCallback(async (messageText: string): Promise<boolean> => {
    if (!characterId || !personaId || !messageText.trim()) {
      return false;
    }

    const trimmedMessage = messageText.trim();
    
    try {
      const API_BASE = getApiUrl();
      
      const response = await optimizedFetch<{ success: boolean; message?: string }>(
        `${API_BASE}/api/chat`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId,
            characterId: parseInt(characterId),
            message: trimmedMessage,
          }),
        },
        0, // 전송은 캐시하지 않음
        false
      );

      if (response?.success) {
        // 관련 캐시 무효화
        const chatCacheKey = createCacheKey(`${API_BASE}/api/chat/${characterId}?personaId=${personaId}`);
        chatCache.delete(chatCacheKey);
        
        // 메시지 목록 새로고침
        lastParamsRef.current = ''; // 강제 새로고침
        await loadMessages();
        return true;
      } else {
        throw new Error(response?.message || '메시지 전송에 실패했습니다.');
      }

    } catch (err: any) {
      console.error('메시지 전송 에러:', err);
      setError(err.message || '메시지 전송 중 오류가 발생했습니다.');
      return false;
    }
  }, [characterId, personaId, getApiUrl, loadMessages]);

  // 최적화된 효과 훅
  useEffect(() => {
    loadMessages();
  }, [characterId, personaId]); // loadMessages는 의존성에서 제외 (무한 루프 방지)

  // 정리 함수 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      loadingRef.current = false;
      lastParamsRef.current = '';
    };
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 활성 요청 정리
      const requestEntries = Array.from(activeRequests.entries());
      for (const [key, request] of requestEntries) {
        if (key.includes(characterId || '') || key.includes(personaId || '')) {
          activeRequests.delete(key);
        }
      }
    };
  }, [characterId, personaId]);

  return {
    messages,
    favor,
    loading,
    error,
    sendMessage,
    clearError,
    hasLoaded,
    pagination,
    canLoadMore: pagination?.hasMore || false,
    backgroundImageUrl,
    apiUrl: getApiUrl(),
    refreshData: useCallback(() => {
      lastParamsRef.current = '';
      return loadMessages();
    }, [loadMessages])
  };
}
