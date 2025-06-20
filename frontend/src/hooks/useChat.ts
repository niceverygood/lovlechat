import { useCallback, useEffect, useState, useRef } from "react";
import { apiGet, apiPost, apiDelete, getApiUrl } from '../lib/openai';

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

// 메모리 캐싱 (성능 최적화)
const chatCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2분 캐싱

// 요청 디바운싱
const requestQueue = new Map<string, Promise<any>>();

// 캐시 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(chatCache.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > value.ttl) {
      chatCache.delete(key);
    }
  }
}, 60000); // 1분마다

function createCacheKey(url: string, params?: Record<string, any>): string {
  const paramStr = params ? new URLSearchParams(params).toString() : '';
  return `${url}${paramStr ? '?' + paramStr : ''}`;
}

// 캐싱된 fetch 함수
async function cachedFetch<T>(url: string, options?: RequestInit, ttl: number = CACHE_TTL): Promise<T> {
  const cacheKey = createCacheKey(url);
  const now = Date.now();
  
  // 캐시 확인
  const cached = chatCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached.data;
  }
  
  // 진행 중인 요청 확인 (중복 방지)
  if (requestQueue.has(cacheKey)) {
    return requestQueue.get(cacheKey);
  }
  
  // 새 요청 생성
  const requestPromise = fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // 캐시 저장 (성공한 경우만)
    if (data) {
      chatCache.set(cacheKey, {
        data,
        timestamp: now,
        ttl
      });
    }
    
    return data;
  }).finally(() => {
    requestQueue.delete(cacheKey);
  });
  
  requestQueue.set(cacheKey, requestPromise);
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
  const isLoadingRef = useRef(false);
  const currentParamsRef = useRef<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getApiUrl = useCallback(() => {
    return process.env.REACT_APP_API_URL || 'http://localhost:3002';
  }, []);

  // 최적화된 메시지 로딩
  const loadMessages = useCallback(async () => {
    if (!characterId || !personaId) return;
    
    const currentParams = `${characterId}-${personaId}`;
    
    // 중복 요청 방지
    if (isLoadingRef.current || currentParamsRef.current === currentParams) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    isLoadingRef.current = true;
    currentParamsRef.current = currentParams;
    setLoading(true);
    clearError();

    try {
      const API_BASE = getApiUrl();
      
      // 캐싱된 fetch 사용
      const response = await cachedFetch<ChatResponse>(
        `${API_BASE}/api/chat/${characterId}?personaId=${personaId}`,
        { signal: abortControllerRef.current.signal },
        CACHE_TTL
      );

      if (response && response.messages) {
        // 메시지 데이터 변환 (기존 Msg 인터페이스에 맞게)
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
        setError(err.message || '메시지를 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [characterId, personaId, clearError, getApiUrl]);

  // 메시지 전송 (최적화)
  const sendMessage = useCallback(async (messageText: string): Promise<boolean> => {
    if (!characterId || !personaId || !messageText.trim()) {
      return false;
    }

    try {
      const API_BASE = getApiUrl();
      
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personaId,
          characterId: parseInt(characterId),
          message: messageText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`메시지 전송 실패: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // 캐시 무효화 (새 메시지로 인해)
        const chatCacheKey = createCacheKey(`${API_BASE}/api/chat/${characterId}?personaId=${personaId}`);
        chatCache.delete(chatCacheKey);
        
        // 메시지 목록 새로고침
        await loadMessages();
        return true;
      } else {
        throw new Error(result.message || '메시지 전송에 실패했습니다.');
      }

    } catch (err: any) {
      console.error('메시지 전송 에러:', err);
      setError(err.message || '메시지 전송 중 오류가 발생했습니다.');
      return false;
    }
  }, [characterId, personaId, getApiUrl, loadMessages]);

  // 최적화된 useEffect (중복 호출 방지)
  useEffect(() => {
    const currentParams = `${characterId}-${personaId}`;
    
    // 파라미터가 변경된 경우에만 로드
    if (currentParams !== currentParamsRef.current) {
      loadMessages();
    }
  }, [characterId, personaId, loadMessages]);

  // 정리 함수
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isLoadingRef.current = false;
      currentParamsRef.current = null;
    };
  }, []);

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
    refreshData: loadMessages
  };
}
