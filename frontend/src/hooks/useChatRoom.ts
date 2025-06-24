import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiGet, apiPost, apiDelete } from '../lib/api';

// 타입 정의
interface Message {
  id: string;
  text: string;
  message: string;
  sender: 'user' | 'character' | 'ai';
  timestamp: string;
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
  avatar?: string;
}

interface Character {
  id: number;
  name: string;
  profileImg: string;
  backgroundImg?: string;
  age?: number;
  job?: string;
  info?: string;
  habit?: string;
  firstScene?: string;
  firstMessage?: string;
}

interface Persona {
  id: string;
  name: string;
  avatar: string;
  gender?: string;
  age?: number;
  job?: string;
  info?: string;
  habit?: string;
}

interface ChatRoomData {
  character: Character | null;
  persona: Persona | null;
  messages: Message[];
  days: number;
  favor: number;
  hearts: number;
  backgroundImageUrl?: string;
  messageCount: number;
  hasMoreMessages: boolean;
  loading: boolean;
  error: string | null;
  cached?: boolean;
  responseTime?: number;
}

interface ChatRoomActions {
  sendMessage: (message: string) => Promise<void>;
  refreshChatRoom: () => Promise<void>;
  clearCache: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
}

// 캐시 관리
const chatRoomCache = new Map<string, { data: ChatRoomData; timestamp: number }>();
const CACHE_DURATION = 3 * 60 * 1000; // 3분

// useChatRoom 훅
export const useChatRoom = (characterId?: string, personaId?: string): ChatRoomData & ChatRoomActions => {
  const { user } = useAuth();
  const [state, setState] = useState<ChatRoomData>({
    character: null,
    persona: null,
    messages: [],
    days: 1,
    favor: 0,
    hearts: 0,
    backgroundImageUrl: undefined,
    messageCount: 0,
    hasMoreMessages: false,
    loading: false,
    error: null
  });

  const isUnmountedRef = useRef(false);
  const currentPageRef = useRef(1);

  // 컴포넌트 언마운트 감지
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // 캐시 키 생성
  const getCacheKey = useCallback(() => {
    if (!characterId || !personaId) return null;
    return `chatroom:${characterId}:${personaId}:${user?.uid || 'guest'}`;
  }, [characterId, personaId, user?.uid]);

  // 로컬 캐시 확인
  const getFromCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    const cached = chatRoomCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, [getCacheKey]);

  // 로컬 캐시 저장
  const saveToCache = useCallback((data: ChatRoomData) => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    chatRoomCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }, [getCacheKey]);

  // 채팅방 데이터 로드
  const loadChatRoomData = useCallback(async (showLoading = true) => {
    if (!characterId || !personaId || isUnmountedRef.current) return;

    // 로컬 캐시 확인
    const cachedData = getFromCache();
    if (cachedData) {
      console.log('✅ useChatRoom: 로컬 캐시 히트');
      setState(prev => ({ ...prev, ...cachedData, loading: false }));
      return;
    }

    if (showLoading) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      const params = new URLSearchParams({
        personaId,
        ...(user?.uid && { userId: user.uid })
      });

      const data = await apiGet(`/api/chatroom/${characterId}?${params}`);

      if (!isUnmountedRef.current && data.ok) {
        const newState: ChatRoomData = {
          character: data.character,
          persona: data.persona,
          messages: data.messages || [],
          days: data.days || 1,
          favor: data.favor || 0,
          hearts: data.hearts || 0,
          backgroundImageUrl: data.backgroundImageUrl,
          messageCount: data.messageCount || 0,
          hasMoreMessages: data.hasMoreMessages || false,
          loading: false,
          error: null,
          cached: data.cached,
          responseTime: data.responseTime
        };

        setState(prev => ({ ...prev, ...newState }));
        saveToCache(newState);
        currentPageRef.current = 1;

        console.log(`✅ useChatRoom: 데이터 로드 완료 (${data.cached ? '서버 캐시' : '신규'}, ${data.responseTime}ms)`);
      }
    } catch (error) {
      console.error('❌ useChatRoom: 로드 실패:', error);
      if (!isUnmountedRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '채팅방을 불러오는데 실패했습니다.'
        }));
      }
    }
  }, [characterId, personaId, user?.uid, getFromCache, saveToCache]);

  // 메시지 전송
  const sendMessage = useCallback(async (message: string) => {
    if (!characterId || !personaId || !message.trim() || isUnmountedRef.current) return;
    
    const userIdToSend = user?.uid;
    if (!userIdToSend) {
      setState(prev => ({ ...prev, error: '로그인 후 이용해 주세요!' }));
      return;
    }

    // 사용자 메시지 즉시 추가
    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      message: message,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      loading: true,
      error: null
    }));

    try {
      const data = await apiPost('/api/chat', {
        personaId,
        characterId: parseInt(characterId),
        message,
        sender: 'user',
        userId: userIdToSend
      });

      if (!isUnmountedRef.current && data) {
        if (Array.isArray(data.messages)) {
          // 전체 메시지 목록으로 업데이트
          const formattedMessages = data.messages.map((msg: any) => ({
            id: msg.id?.toString() || Date.now().toString(),
            text: msg.message || msg.text || '',
            message: msg.message || msg.text || '',
            sender: msg.sender === 'assistant' ? 'ai' : msg.sender,
            timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
            characterName: msg.characterName,
            characterProfileImg: msg.characterProfileImg,
            characterAge: msg.characterAge,
            characterJob: msg.characterJob,
            avatar: msg.avatar
          }));

          setState(prev => ({
            ...prev,
            messages: formattedMessages,
            favor: data.favor || prev.favor,
            loading: false
          }));

          // 호감도 변화 이벤트 발생
          if (data.favorChange && data.favorChange !== 0) {
            const favorEvent = new CustomEvent('favorChange', {
              detail: {
                change: data.favorChange,
                current: data.favor || 0,
                previous: data.previousFavor || 0
              }
            });
            window.dispatchEvent(favorEvent);
          }
        } else {
          // 메시지 리스트 다시 로드
          await loadChatRoomData(false);
        }

        // 캐시 무효화
        await clearCache();
      }
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      if (!isUnmountedRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '메시지 전송에 실패했습니다.'
        }));
      }
    }
  }, [characterId, personaId, user?.uid, loadChatRoomData]);

  // 이전 메시지 더 불러오기
  const loadMoreMessages = useCallback(async () => {
    if (!characterId || !personaId || state.loading || !state.hasMoreMessages) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const nextPage = currentPageRef.current + 1;
      const data = await apiGet(`/api/chat?personaId=${personaId}&characterId=${characterId}&page=${nextPage}&limit=20`);

      if (!isUnmountedRef.current && data && Array.isArray(data.messages) && data.messages.length > 0) {
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id?.toString() || Date.now().toString(),
          text: msg.message || msg.text || '',
          message: msg.message || msg.text || '',
          sender: msg.sender === 'assistant' ? 'ai' : msg.sender,
          timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
          characterName: msg.characterName,
          characterProfileImg: msg.characterProfileImg,
          characterAge: msg.characterAge,
          characterJob: msg.characterJob,
          avatar: msg.avatar
        }));

        setState(prev => ({
          ...prev,
          messages: [...formattedMessages.reverse(), ...prev.messages],
          hasMoreMessages: data.messages.length === 20,
          loading: false
        }));

        currentPageRef.current = nextPage;
      } else {
        setState(prev => ({ ...prev, hasMoreMessages: false, loading: false }));
      }
    } catch (error) {
      console.error('❌ 이전 메시지 로드 실패:', error);
      if (!isUnmountedRef.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [characterId, personaId, state.loading, state.hasMoreMessages]);

  // 캐시 무효화
  const clearCache = useCallback(async () => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      chatRoomCache.delete(cacheKey);
    }

    // 서버 캐시도 무효화
    if (characterId && personaId) {
      try {
        const params = new URLSearchParams({
          personaId,
          ...(user?.uid && { userId: user.uid })
        });
        await apiDelete(`/api/chatroom/cache/${characterId}?${params}`);
      } catch (error) {
        console.error('서버 캐시 무효화 실패:', error);
      }
    }
  }, [getCacheKey, characterId, personaId, user?.uid]);

  // 채팅방 새로고침
  const refreshChatRoom = useCallback(async () => {
    await clearCache();
    await loadChatRoomData(true);
  }, [clearCache, loadChatRoomData]);

  // 초기 데이터 로드
  useEffect(() => {
    if (characterId && personaId) {
      loadChatRoomData(true);
    }
  }, [characterId, personaId, loadChatRoomData]);

  return {
    ...state,
    sendMessage,
    refreshChatRoom,
    clearCache,
    loadMoreMessages
  };
}; 