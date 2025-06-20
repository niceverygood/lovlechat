import { useCallback, useEffect, useState, useRef } from "react";
import { apiGet, apiPost, apiDelete, getApiUrl } from '../lib/openai';

export interface Msg {
  sender: "user" | "ai" | "system";
  text: string;
  avatar?: string;
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
  name?: string;
  age?: number | string;
  job?: string;
  timestamp?: string;
}

export interface ChatPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function useChat(
  characterId: string, 
  personaId: string, 
  personaAvatar?: string, 
  userId?: string,
  consumeHearts?: (amount: number, description: string, relatedId?: string) => Promise<boolean>
) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [favor, setFavor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ChatPagination | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [backgroundImageUrl] = useState<string>('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>('');
  const isLoadingRef = useRef<boolean>(false);

  // 현재 채팅 파라미터 문자열 생성
  const currentParams = `${characterId}_${personaId}`;

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 메시지 불러오기 (대폭 최적화)
  const loadMessages = useCallback(async () => {
    if (!characterId || !personaId) return;
    
    // 중복 호출 방지 (강화)
    if (isLoadingRef.current || (lastParamsRef.current === currentParams && hasLoaded)) {
      return;
    }
    
    isLoadingRef.current = true;
    
    try {
      setLoading(true);
      clearError();
      
      // 기존 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      console.log('📨 메시지 로딩:', { characterId, personaId });
      
      const endpoint = `/api/chat/${characterId}?personaId=${personaId}`;
      const data = await apiGet(endpoint, true); // 캐싱 활성화
      
      if (controller.signal.aborted) return;
      
      if (data.ok || data.messages) {
        const formattedMessages = (data.messages || []).map((msg: any) => ({
          sender: msg.sender,
          text: msg.message,
          characterName: msg.characterName,
          characterProfileImg: msg.characterProfileImg,
          characterAge: msg.characterAge,
          characterJob: msg.characterJob,
          timestamp: msg.timestamp || msg.createdAt
        }));
        
        setMessages(formattedMessages);
        
        if (typeof data.favor === 'number') {
          setFavor(data.favor);
        }
        
        if (data.pagination) {
          setPagination(data.pagination);
        }
        
        lastParamsRef.current = currentParams;
        setHasLoaded(true);
        
        if (data.fallback) {
          console.warn("⚠️ 폴백 데이터 사용");
        }
      } else {
        throw new Error(data.error || "메시지를 불러올 수 없습니다.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error("❌ 메시지 로드 에러:", err.message);
      
      // 네트워크 에러 시 사용자 친화적 메시지
      let errorMessage = err.message;
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMessage = "네트워크 연결을 확인해주세요.";
      } else if (err.message?.includes('timeout')) {
        errorMessage = "서버 응답이 느립니다. 새로고침 해주세요.";
      }
      
      setError(errorMessage);
      setMessages([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [characterId, personaId, clearError, currentParams, hasLoaded]);

  // 컴포넌트 마운트 시 또는 파라미터 변경 시 메시지 로드 (최적화)
  useEffect(() => {
    if (!characterId || !personaId) return;
    
    // 파라미터가 변경된 경우에만 새로 로드
    if (lastParamsRef.current !== currentParams) {
      setHasLoaded(false);
      setMessages([]);
      setPagination(null);
      setFavor(0);
      clearError();
      isLoadingRef.current = false;
    }
    
    // 약간의 디바운싱 적용
    const timeoutId = setTimeout(() => {
      loadMessages();
    }, 50);
    
    // 컴포넌트 언마운트 시 요청 취소
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [characterId, personaId, loadMessages]);

  // 메시지 전송 (최적화됨)
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading || isLoadingRef.current) return;
    
    const messageText = message.trim();
    
    // 하트 사용 체크 (게스트 모드 제외)
    if (consumeHearts && userId && personaId !== 'guest') {
      const heartUsed = await consumeHearts(10, `${personaId}와 ${characterId} 대화`, `${personaId}_${characterId}`);
      if (!heartUsed) {
        setError("하트가 부족합니다. 하트샵에서 충전해주세요.");
        return;
      }
    }
    
    setInput("");
    setLoading(true);
    clearError();
    
    // 사용자 메시지 즉시 표시
    const userMessage: Msg = {
      sender: "user",
      text: messageText,
      avatar: personaAvatar,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      console.log('💬 메시지 전송:', messageText);
      
      const data = await apiPost('/api/chat', {
        characterId,
        personaId,
        message: messageText,
        sender: "user",
        userId: personaId === 'guest' ? null : userId
      });

      if (data.ok && data.aiText) {
        const aiMessage: Msg = {
          sender: "ai",
          text: data.aiText,
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // 호감도 업데이트
        if (data.favorDelta && data.favorDelta !== 0) {
          setFavor(prev => Math.max(0, Math.min(100, prev + data.favorDelta)));
        }
        
        console.log("✅ 메시지 전송 성공");
      } else {
        throw new Error(data.error || "AI 응답 생성에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("❌ 메시지 전송 실패:", err.message);
      
      // 실패한 사용자 메시지 제거
      setMessages(prev => prev.slice(0, -1));
      
      // 에러 메시지 표시
      const errorMessage: Msg = {
        sender: "system",
        text: `메시지 전송 실패: ${err.message || '알 수 없는 오류'}. 다시 시도해주세요.`
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setError(err.message || "메시지 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [characterId, personaId, loading, clearError, personaAvatar, consumeHearts, userId]);

  // 채팅 내역 삭제
  const clearChat = useCallback(async () => {
    if (!window.confirm("모든 채팅 내역을 삭제하시겠습니까?")) return;
    
    try {
      clearError();
      await apiDelete(`/api/chat?personaId=${personaId}&characterId=${characterId}`);
      
      setMessages([]);
      setFavor(0);
      setPagination(null);
      console.log("🗑️ 채팅 내역 삭제 완료");
    } catch (err: any) {
      console.error("❌ 채팅 삭제 에러:", err.message);
      setError("채팅 삭제에 실패했습니다.");
    }
  }, [personaId, characterId, clearError]);

  // 메시지 새로고침
  const refreshMessages = useCallback(() => {
    lastParamsRef.current = '';
    setHasLoaded(false);
    setMessages([]);
    setPagination(null);
    setFavor(0);
    clearError();
    isLoadingRef.current = false;
    loadMessages();
  }, [clearError, loadMessages]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    loading,
    favor,
    error,
    pagination,
    clearError,
    clearChat,
    refreshMessages,
    hasError: !!error,
    canLoadMore: pagination?.hasMore || false,
    backgroundImageUrl,
    apiUrl: getApiUrl()
  };
}
