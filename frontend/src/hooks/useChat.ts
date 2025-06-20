import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [favor, setFavor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ChatPagination | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;
  const abortControllerRef = useRef<AbortController | null>(null);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 의존성 배열 메모이제이션 (불필요한 재요청 방지)
  const deps = useMemo(() => ({ characterId, personaId }), [characterId, personaId]);
  
  // 메시지 불러오기 최적화 (캐싱 및 페이지네이션 지원)
  const loadMessages = useCallback(async (page = 1, append = false) => {
    if (!deps.characterId || !deps.personaId) return;
    
    const controller = new AbortController();
    if (!append) {
      // 새로운 로드시에만 기존 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = controller;
    }
    
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      clearError();
      
      console.log('📨 Loading messages for:', deps, { page, append });
      
      const endpoint = `/api/chat/${deps.characterId}?personaId=${deps.personaId}&page=${page}`;
      const data = await apiGet(endpoint, page === 1); // 첫 페이지만 캐싱
      
      console.log('✅ Loaded messages:', data);
      
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
        
        if (append) {
          setMessages(prev => [...formattedMessages, ...prev]);
        } else {
          setMessages(formattedMessages);
        }
        
        if (typeof data.favor === 'number') {
          setFavor(data.favor);
        }
        
        if (data.pagination) {
          setPagination(data.pagination);
        }
        
        if (data.fallback) {
          console.warn("⚠️ 채팅 데이터를 폴백으로 로드했습니다.");
        }
        
        if (data.cached) {
          console.log("💾 캐시된 데이터 사용");
        }
      } else {
        console.error('❌ Message loading error data:', data);
        throw new Error(data.error || "메시지 로드에 실패했습니다.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error("❌ 메시지 로드 에러:", err);
      
      // 네트워크 에러일 때 더 친화적인 메시지
      let errorMessage = err.message;
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMessage = "네트워크 연결을 확인해주세요.";
      } else if (err.message?.includes('timeout')) {
        errorMessage = "서버 응답이 느립니다. 잠시 후 다시 시도해주세요.";
      }
      
      setError(errorMessage);
      if (!append) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsInitialLoad(false);
    }
  }, [deps, clearError]);

  // 더 많은 메시지 로드 (페이지네이션)
  const loadMoreMessages = useCallback(async () => {
    if (!pagination?.hasPrevPage || loadingMore) return;
    
    const nextPage = pagination.page + 1;
    await loadMessages(nextPage, true);
  }, [pagination, loadingMore, loadMessages]);

  // 초기 메시지 로드
  useEffect(() => {
    if (!deps.characterId || !deps.personaId) return;
    
    // 컴포넌트가 변경될 때만 초기 로드
    setIsInitialLoad(true);
    loadMessages(1, false);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [deps]); // loadMessages를 의존성에서 제거하여 무한 루프 방지

  // 메시지 전송 최적화 (성능 개선 및 에러 처리 강화)
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading) return;
    
    const messageText = message.trim();
    
    // 하트 사용 시도 (10하트 소모) - 게스트 모드는 제외
    if (consumeHearts && userId && personaId !== 'guest') {
      const heartUsed = await consumeHearts(10, `${personaId}와 ${characterId} 대화`, `${personaId}_${characterId}`);
      if (!heartUsed) {
        setError("하트가 부족합니다. 하트샵에서 충전해주세요.");
        return;
      }
    }
    
    // 진행 중인 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setInput("");
    setLoading(true);
    clearError();
    
    // 새로운 AbortController 생성
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // 낙관적 업데이트 (사용자 메시지 즉시 표시)
    const userMessage: Msg = {
      sender: "user",
      text: messageText,
      avatar: personaAvatar,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // 재시도 로직 개선
    const attemptSend = async (attempt: number): Promise<void> => {
      try {
        console.log(`💬 메시지 전송 시도 ${attempt + 1}/${MAX_RETRIES + 1}:`, messageText);
        
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
          
          // 배경 이미지 생성 트리거 (비동기)
          if (data.backgroundImageUrl === "generating") {
            console.log("🎨 배경 이미지 생성 중...");
            
            // 비동기로 배경 이미지 생성
            setTimeout(async () => {
              try {
                const bgData = await apiPost('/api/chat/generate-background', {
                  character: { id: characterId, firstScene: null },
                  recentMessages: [messageText, data.aiText],
                  currentMood: data.favorDelta > 30 ? '기쁨' : data.favorDelta < -10 ? '슬픔' : '평온'
                });
                
                if (bgData.ok && bgData.imageUrl) {
                  console.log("🎨 배경 이미지 생성 완료:", bgData.imageUrl);
                  setBackgroundImageUrl(bgData.imageUrl);
                }
              } catch (err) {
                console.warn("⚠️ 배경 이미지 생성 실패:", err);
              }
            }, 3000);
          }
          
          retryCountRef.current = 0; // 성공시 재시도 횟수 초기화
          console.log("✅ 메시지 전송 성공");
        } else {
          throw new Error(data.error || "AI 응답 생성에 실패했습니다.");
        }
      } catch (err: any) {
        console.error(`❌ 메시지 전송 시도 ${attempt + 1} 실패:`, err);
        
        if (attempt < MAX_RETRIES && !err.message?.includes('하트')) {
          console.log(`🔄 재시도 중... (${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 지수 백오프
          return attemptSend(attempt + 1);
        }
        
        // 최종 실패시 사용자 메시지 제거하고 에러 메시지 추가
        setMessages(prev => prev.slice(0, -1)); // 마지막 사용자 메시지 제거
        
        const errorMessage: Msg = {
          sender: "system",
          text: `메시지 전송에 실패했습니다: ${err.message || '알 수 없는 오류'}. 잠시 후 다시 시도해주세요.`
        };
        
        setMessages(prev => [...prev, errorMessage]);
        setError(err.message || "메시지 전송에 실패했습니다.");
      }
    };

    try {
      await attemptSend(0);
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [characterId, personaId, loading, clearError, personaAvatar, consumeHearts, userId]);

  // 채팅 내역 삭제 (확인 다이얼로그 포함)
  const clearChat = useCallback(async () => {
    if (!window.confirm("정말로 모든 채팅 내역을 삭제하시겠습니까?")) return;
    
    try {
      clearError();
      
      await apiDelete(`/api/chat?personaId=${personaId}&characterId=${characterId}`);
      
      setMessages([]);
      setFavor(0);
      setPagination(null);
      console.log("🗑️ 채팅 내역 삭제 완료");
    } catch (err: any) {
      console.error("❌ 채팅 삭제 에러:", err);
      setError(err.message || "채팅 삭제에 실패했습니다.");
    }
  }, [personaId, characterId, clearError]);

  // 메시지 새로고침
  const refreshMessages = useCallback(() => {
    setMessages([]);
    setPagination(null);
    clearError();
    loadMessages(1, false);
  }, [clearError, loadMessages]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    loading: loading || isInitialLoad,
    loadingMore,
    favor,
    error,
    backgroundImageUrl,
    pagination,
    clearError,
    clearChat,
    refreshMessages,
    loadMoreMessages,
    hasError: !!error,
    canLoadMore: pagination?.hasPrevPage || false,
    apiUrl: getApiUrl() // 디버깅용
  };
}
