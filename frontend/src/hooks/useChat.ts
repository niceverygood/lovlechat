import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { API_BASE_URL } from '../lib/openai';

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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 1; // 2 → 1 (빠른 에러 처리)
  const abortControllerRef = useRef<AbortController | null>(null);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 의존성 배열 메모이제이션 (불필요한 재요청 방지)
  const deps = useMemo(() => ({ characterId, personaId }), [characterId, personaId]);
  
  // 메시지 불러오기 최적화 (중복 요청 방지 및 성능 강화)
  useEffect(() => {
    if (!deps.characterId || !deps.personaId) return;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let isMounted = true;
    
    const loadMessages = async () => {
      try {
        clearError();
        
        // 중복 요청 방지
        if (loading) return;
        
        console.log('Loading messages for:', deps);
        
        const response = await fetch(
          `${API_BASE_URL}/api/chat/${deps.characterId}?personaId=${deps.personaId}`,
          { 
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Message loading error response:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText || '서버 응답 오류'}`);
        }
        
        const data = await response.json();
        console.log('Loaded messages:', data);
        
        if (!isMounted) return;
        
        if (data.ok) {
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
          
          if (data.fallback) {
            console.warn("채팅 데이터를 폴백으로 로드했습니다.");
          }
        } else {
          console.error('Message loading error data:', data);
          throw new Error(data.error || "메시지 로드에 실패했습니다.");
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        console.error("메시지 로드 에러:", err);
        
        if (isMounted) {
          setError(err.message || "메시지를 불러오는 중 오류가 발생했습니다.");
          setMessages([]);
        }
      }
    };

    loadMessages();
    
    return () => {
      isMounted = false;
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [deps, clearError, loading]);

  // 메시지 전송 최적화 (중복 전송 방지 및 낙관적 업데이트)
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading) return;
    
    const messageText = message.trim();
    
    // 하트 사용 시도 (10하트 소모) - 게스트 모드는 제외
    if (consumeHearts && userId && personaId !== 'guest') {
      const heartUsed = await consumeHearts(10, `${personaId}와 ${characterId} 대화`, `${personaId}_${characterId}`);
      if (!heartUsed) {
        // 하트 사용 실패 (부족하거나 에러)
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
    
    // 재시도 로직
    const attemptSend = async (attempt: number): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            characterId,
            personaId,
            message: messageText,
            sender: "user",
            userId: personaId === 'guest' ? null : userId // 게스트 모드일 때는 userId를 null로 전달
          }),
          signal: controller.signal // AbortController 추가
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || '서버 응답 오류'}`);
        }

        const data = await response.json();

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
          
          // 배경 이미지 생성 트리거
          if (data.backgroundImageUrl === "generating") {
            console.log("🎨 배경 이미지 생성 중...");
            // 약간의 딜레이 후 실제 이미지를 가져옴
            setTimeout(async () => {
              try {
                const bgResponse = await fetch(`${API_BASE_URL}/api/chat/generate-background`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    character: { id: characterId, firstScene: null }, // 실제 캐릭터 정보는 백엔드에서 가져옴
                    recentMessages: [messageText, data.aiText],
                    currentMood: data.favorDelta > 30 ? '기쁨' : data.favorDelta < -10 ? '슬픔' : '평온'
                  })
                });
                
                if (bgResponse.ok) {
                  const bgData = await bgResponse.json();
                  if (bgData.ok && bgData.imageUrl) {
                    console.log("🎨 배경 이미지 생성 완료:", bgData.imageUrl);
                    setBackgroundImageUrl(bgData.imageUrl);
                  }
                }
              } catch (err) {
                console.warn("배경 이미지 생성 실패:", err);
              }
            }, 3000); // 3초 후 이미지 생성 완료 확인
          }
          
          retryCountRef.current = 0; // 성공시 재시도 횟수 초기화
        } else {
          throw new Error(data.error || "AI 응답 생성에 실패했습니다.");
        }
      } catch (err: any) {
        console.error(`메시지 전송 시도 ${attempt + 1} 실패:`, err);
        
        if (attempt < MAX_RETRIES) {
          console.log(`재시도 중... (${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 지수 백오프
          return attemptSend(attempt + 1);
        }
        
        // 최종 실패시 에러 메시지 추가
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
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, characterId }),
      });

      if (response.ok) {
        setMessages([]);
        setFavor(0);
      } else {
        const errorText = await response.text();
        throw new Error(`삭제 실패: ${errorText || '서버 오류'}`);
      }
    } catch (err: any) {
      console.error("채팅 삭제 에러:", err);
      setError(err.message || "채팅 삭제에 실패했습니다.");
    }
  }, [personaId, characterId, clearError]);

  // 메시지 새로고침
  const refreshMessages = useCallback(() => {
    setMessages([]);
    clearError();
    // useEffect가 자동으로 다시 실행됩니다
  }, [clearError]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    loading,
    favor,
    error,
    backgroundImageUrl,
    clearError,
    clearChat,
    refreshMessages,
    hasError: !!error
  };
}
