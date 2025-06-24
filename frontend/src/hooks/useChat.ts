import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { apiGet, apiPost } from '../lib/api';

// === 타입 정의 ===
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

interface ChatState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  favor: number;
  favorChange: number;
  backgroundImageUrl?: string;
}

interface Character {
  id: number;
  name: string;
  profileImg: string;
  backgroundImg?: string;
  firstMessage?: string;
  age?: number;
  job?: string;
  info?: string;
  habit?: string;
}

interface ChatListItem {
  characterId: number;
  personaId: string;
  name: string;
  profileImg: string;
  lastMessage: string;
  lastMessageTime: string;
}

// === useChat 훅 ===
export const useChat = (characterId?: number | string, personaId?: string) => {
  const { user } = useAuth();
  const [state, setState] = useState<ChatState>({
    messages: [],
    loading: false,
    error: null,
    favor: 0,
    favorChange: 0,
    backgroundImageUrl: undefined
  });

  const isUnmountedRef = useRef(false);

  // 컴포넌트 언마운트 감지
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // === 메시지 로드 (페이징 지원) - 최적화 ===
  const loadMessages = useCallback(async (characterId: number | string, personaId: string, page = 1, append = false) => {
    if (!personaId || isUnmountedRef.current) return;
    
    // console.log('🔄 loadMessages 호출됨:', { characterId, personaId, page, append });
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // console.log('🌐 요청 URL: /api/chat');
      
      // 페이징 파라미터 추가 (첫 로드는 최신 20개, 이전 메시지는 20개씩 추가)
      const limit = 20;
      const data = await apiGet(`/api/chat?personaId=${personaId}&characterId=${characterId}&page=${page}&limit=${limit}`);
      
      if (!isUnmountedRef.current) {
        if (data && data.messages && Array.isArray(data.messages)) {
          try {
            const formattedMessages = data.messages.map((msg: any, index: number) => {
              return {
                id: msg.id?.toString() || Date.now().toString() + index,
                text: msg.message || msg.text || '',
                message: msg.message || msg.text || '',
                sender: msg.sender === 'assistant' ? 'ai' : msg.sender,
                timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
                characterName: msg.characterName,
                characterProfileImg: msg.characterProfileImg,
                characterAge: msg.characterAge,
                characterJob: msg.characterJob,
                avatar: msg.avatar
              };
            });
            
            setState(prev => {
              // append 모드: 기존 메시지 앞에 새 메시지들 추가 (무한 스크롤)
              // 기본 모드: 전체 메시지 교체
              const finalMessages = append 
                ? [...formattedMessages, ...prev.messages]
                : formattedMessages;
              
              return {
                ...prev,
                messages: finalMessages,
                favor: data.favor || prev.favor,
                favorChange: 0,
                loading: false,
                pagination: data.pagination
              };
            });
            
          } catch (mapError) {
            console.error('💥 메시지 매핑 에러:', mapError);
            setState(prev => ({ ...prev, messages: [], loading: false }));
          }
        } else {
          console.log('❌ 메시지 데이터 없음 또는 잘못된 형식', {
            data: !!data,
            messages: !!data?.messages,
            isArray: Array.isArray(data?.messages)
          });
          setState(prev => ({ ...prev, messages: [], loading: false }));
        }
      }
    } catch (error) {
      console.error('💥 loadMessages 에러:', error);
      if (!isUnmountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    }
  }, []);

  // === 메시지 전송 ===
  const sendMessage = useCallback(async (message: string) => {
    const userIdToSend = user?.uid;
    if (!userIdToSend) {
      alert('로그인 후 이용해 주세요!');
      return;
    }
    if (!characterId || !personaId || !message?.trim()) {
      console.error('❌ sendMessage: 필수 파라미터 누락', { characterId, personaId, message });
      return;
    }
    
    const charId = String(characterId);
    const persId = String(personaId);
    
    if (isUnmountedRef.current) return;
    
    // 1️⃣ 사용자 메시지를 즉시 UI에 추가
    const userMessage = {
      id: Date.now().toString(),
      text: message,
      message: message,
      sender: 'user' as const,
      timestamp: new Date().toISOString(),
      characterName: undefined,
      characterProfileImg: undefined,
      characterAge: undefined,
      characterJob: undefined,
      avatar: undefined
    };
    
    // console.log('👤 사용자 메시지 즉시 추가:', userMessage);
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      loading: true, // 로딩 시작
      error: null
    }));
    
    // 사용자 메시지 추가 후 스크롤
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    
    try {
      const data = await apiPost('/api/chat', { 
        personaId: persId, 
        characterId: parseInt(charId),
        message: message,
        sender: 'user',
        userId: userIdToSend
      });
      
      if (isUnmountedRef.current) return;
      
              if (data && Array.isArray(data.messages)) {
        // 2️⃣ 백엔드에서 받은 전체 메시지 목록으로 업데이트
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
        
        // 호감도 변화 체크 및 토스트 표시
        const favorChange = data.favorChange || 0;
        if (favorChange !== 0) {
          const favorEvent = new CustomEvent('favorChange', {
            detail: {
              change: favorChange,
              current: data.favor || 0,
              previous: data.previousFavor || 0
            }
          });
          window.dispatchEvent(favorEvent);
        }
        
        setState(prev => ({
          ...prev,
          messages: formattedMessages,
          favor: data.favor || prev.favor,
          favorChange: favorChange,
          loading: false
        }));
        
        // AI 응답 받은 후 스크롤
        setTimeout(() => {
          const messagesContainer = document.querySelector('.messages-container');
          if (messagesContainer) {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 100);
              } else {
        // 3️⃣ 메시지 리스트를 다시 로드
        await loadMessages(charId, persId);
        setState(prev => ({ ...prev, loading: false }));
        
        // 메시지 리로드 후 스크롤
        setTimeout(() => {
          const messagesContainer = document.querySelector('.messages-container');
          if (messagesContainer) {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 100);
      }
    } catch (error) {
      console.error('💥 sendMessage 에러:', error);
      if (!isUnmountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    } finally {
      // 모든 경우에 로딩 상태 종료
      if (!isUnmountedRef.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [characterId, personaId, loadMessages, user?.uid]);

  // === 초기 데이터 로드 (최적화) ===
  const prevParamsRef = useRef<{characterId?: number | string, personaId?: string}>({});
  
  useEffect(() => {
    // console.log('🚀 useChat useEffect 실행:', { characterId, personaId });
    
    // 이전 파라미터와 동일한지 체크 (불필요한 재로드 방지)
    const hasParamsChanged = 
      prevParamsRef.current.characterId !== characterId || 
      prevParamsRef.current.personaId !== personaId;
    
    if (!hasParamsChanged) {
      // console.log('⏭️  파라미터 변경 없음 - 로드 건너뜀');
      return;
    }
    
    if (characterId && personaId && typeof personaId === 'string') {
      // console.log('✅ 조건 만족 - loadMessages 호출');
      prevParamsRef.current = { characterId, personaId };
      loadMessages(characterId, personaId);
    }
  }, [characterId, personaId, loadMessages]);

  // === 반환값 ===
  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    favor: state.favor,
    favorChange: state.favorChange,
    backgroundImageUrl: state.backgroundImageUrl,
    sendMessage,
    reloadMessages: () => {
      if (characterId && personaId) {
        loadMessages(characterId, personaId);
      }
    },
    loadMessages
  };
};


