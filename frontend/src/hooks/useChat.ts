import { useState, useCallback, useRef, useEffect } from 'react';

// === 타입 정의 ===
interface Message {
  id: string;
  message: string;
  sender: 'user' | 'character';
  timestamp: string;
  characterName?: string;
  characterProfileImg?: string;
}

interface ChatState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  favor: number;
  backgroundImageUrl?: string;
}

interface Character {
  id: number;
  name: string;
  profileImg: string;
  backgroundImg?: string;
  firstMessage?: string;
}

interface ChatListItem {
  characterId: number;
  personaId: string;
  lastMessage: string;
  lastSender: 'user' | 'character';
  lastMessageAt: string;
  personaName: string;
  personaAvatar: string;
  name: string;
  profileImg: string;
}

// === 🚀 극한 성능 설정 ===
const DEBOUNCE_DELAY = 30; // 30ms 초고속 디바운스
const CACHE_TTL = 5000; // 5초 캐시
const REQUEST_TIMEOUT = 3000; // 3초 타임아웃
const MAX_RETRIES = 1; // 최대 1회 재시도

// === 전역 캐시 및 요청 관리 ===
const globalCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

// === 🔥 초고속 HTTP 클라이언트 ===
const ultraFetch = async <T = any>(
  url: string,
  options: RequestInit = {},
  timeout = REQUEST_TIMEOUT
): Promise<T> => {
  
  const cacheKey = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || {})}`;
  
  // 1. 캐시 확인 (GET 요청만)
  if (!options.method || options.method === 'GET') {
    const cached = globalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  
  // 2. 중복 요청 차단
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey)!;
  }
  
  // 3. 요청 실행
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const requestPromise = (async () => {
    try {
      const response = await fetch(`/api${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // GET 요청 결과 캐싱
      if (!options.method || options.method === 'GET') {
        globalCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        // 캐시 크기 제한 (100개)
        if (globalCache.size > 100) {
          const oldestKey = globalCache.keys().next().value;
          globalCache.delete(oldestKey);
        }
      }
      
      return data;
      
    } catch (error: any) {
      // 타임아웃 시 캐시된 데이터 사용
      if (error.name === 'AbortError') {
        const staleData = globalCache.get(cacheKey);
        if (staleData) {
          return staleData.data;
        }
      }
      throw error;
    }
  })();
  
  activeRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    activeRequests.delete(cacheKey);
    clearTimeout(timeoutId);
  }
};

// === 🚀 초고속 디바운스 ===
const ultraDebounce = (func: Function, delay: number, key: string) => {
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  const timer = setTimeout(() => {
    func();
    debounceTimers.delete(key);
  }, delay);
  
  debounceTimers.set(key, timer);
};

export function useChat(
  characterId?: string,
  personaId?: string,
  personaAvatar?: string,
  userId?: string,
  heartsFunction?: any
) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    loading: false,
    error: null,
    favor: 0,
    backgroundImageUrl: undefined
  });
  
  const isUnmountedRef = useRef(false);
  
  // === 컴포넌트 언마운트 처리 ===
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      // 진행 중인 모든 요청 취소
      Array.from(debounceTimers.values()).forEach(timer => clearTimeout(timer));
      debounceTimers.clear();
    };
  }, []);
  
  // === 🚀 초고속 캐릭터 로드 ===
  const loadCharacter = useCallback(async (characterId: number): Promise<Character> => {
    return ultraFetch(`/character/${characterId}`);
  }, []);
  
  // === 🚀 초고속 메시지 로드 ===
  const loadMessages = useCallback((characterId: number | string, personaId: string) => {
    const debounceKey = `load_${characterId}_${personaId}`;
    
    ultraDebounce(async () => {
      if (isUnmountedRef.current) return;
      
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const data = await ultraFetch(`/chat/${characterId}?personaId=${personaId}`);
        
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            messages: data.messages || [],
            favor: data.favor || 0,
            backgroundImageUrl: data.backgroundImageUrl || data.character?.backgroundImg,
            loading: false
          }));
        }
        
        return data;
        
      } catch (error: any) {
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: '메시지 로드 실패'
          }));
        }
        throw error;
      }
    }, DEBOUNCE_DELAY, debounceKey);
  }, []);
  
  // === 🚀 초고속 메시지 전송 ===
  const sendMessage = useCallback((message: string) => {
    if (!characterId || !personaId) return;
    
    const debounceKey = `send_${characterId}_${personaId}`;
    
    ultraDebounce(async () => {
      if (isUnmountedRef.current) return;
      
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const data = await ultraFetch(`/chat/${characterId}`, {
          method: 'POST',
          body: JSON.stringify({ personaId, message })
        }, 5000); // 메시지 전송은 5초 타임아웃
        
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            messages: data.messages || [],
            favor: data.favor || prev.favor,
            backgroundImageUrl: data.backgroundImageUrl || prev.backgroundImageUrl,
            loading: false
          }));
        }
        
        // 관련 캐시 무효화
        globalCache.forEach((value, key) => {
          if (key.includes(`/chat/${characterId}`) || key.includes('/chat/list')) {
            globalCache.delete(key);
          }
        });
        
        return data;
        
      } catch (error: any) {
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: '메시지 전송 실패'
          }));
        }
        throw error;
      }
    }, DEBOUNCE_DELAY, debounceKey);
  }, [characterId, personaId]);
  
  // === 초기 데이터 로드 ===
  useEffect(() => {
    if (characterId && personaId && characterId.trim() && personaId.trim()) {
      loadMessages(characterId, personaId);
    }
  }, [characterId, personaId, loadMessages]);
  
  // === 🚀 초고속 채팅 목록 ===
  const loadChatList = useCallback(async (userId: string): Promise<ChatListItem[]> => {
    try {
      const data = await ultraFetch(`/chat/list?userId=${userId}`);
      return data || [];
    } catch (error) {
      console.error('채팅 목록 로드 실패:', error);
      return [];
    }
  }, []);
  
  // === 🚀 초고속 첫 만남 날짜 ===
  const getFirstMeetDate = useCallback(async (characterId: number, personaId: string): Promise<string> => {
    try {
      const data = await ultraFetch(`/chat/first-date?characterId=${characterId}&personaId=${personaId}`);
      return data.firstDate || new Date().toISOString().split('T')[0];
    } catch (error) {
      return new Date().toISOString().split('T')[0];
    }
  }, []);
  
  // === 캐시 관리 ===
  const clearCache = useCallback(() => {
    globalCache.clear();
    activeRequests.clear();
  }, []);
  
  const getCacheStats = useCallback(() => {
    return {
      cacheSize: globalCache.size,
      activeRequests: activeRequests.size,
      debounceTimers: debounceTimers.size
    };
  }, []);
  
  return {
    // State
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    favor: state.favor,
    backgroundImageUrl: state.backgroundImageUrl,
    
    // Actions
    sendMessage,
    loadMessages,
    loadCharacter,
    loadChatList,
    getFirstMeetDate,
    
    // Utils
    clearCache,
    getCacheStats
  };
}

// === 🚀 자동 캐시 정리 (5분마다) ===
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    globalCache.forEach((value, key) => {
      if (now - value.timestamp > CACHE_TTL * 10) { // 50초 후 정리
        globalCache.delete(key);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 Frontend cache cleaned: ${cleaned} items`);
    }
  }, 5 * 60 * 1000);
}
