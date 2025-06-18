import { useCallback, useEffect, useState, useRef } from "react";
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

export function useChat(characterId: string, personaId: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [favor, setFavor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const MAX_RETRIES = 2;

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 메시지 불러오기 최적화 (에러 처리 및 성능 강화)
  useEffect(() => {
    if (!characterId || !personaId) return;
    
    const controller = new AbortController();
    let isMounted = true;
    
    const loadMessages = async () => {
      try {
        clearError();
        const response = await fetch(
          `${API_BASE_URL}/api/chat/${characterId}?personaId=${personaId}`,
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
          throw new Error(`HTTP ${response.status}: ${errorText || '서버 응답 오류'}`);
        }
        
        const data = await response.json();
        
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
          setFavor(data.favor || 0);
          
          if (data.fallback) {
            console.warn("채팅 데이터를 폴백으로 로드했습니다.");
          }
        } else {
          throw new Error(data.error || "메시지 로드에 실패했습니다.");
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        console.error("메시지 로드 에러:", err);
        
        if (isMounted) {
          setError(err.message || "메시지를 불러오는 중 오류가 발생했습니다.");
          // 에러 발생시 기본 메시지 표시
          setMessages([{
            sender: "system",
            text: "채팅을 불러오는 중 문제가 발생했습니다. 새로고침하거나 잠시 후 다시 시도해주세요."
          }]);
        }
      }
    };

    loadMessages();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [characterId, personaId, clearError]);

  // 메시지 전송 최적화 (재시도 로직 및 낙관적 업데이트)
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading) return;
    
    const messageText = message.trim();
    setInput("");
    setLoading(true);
    clearError();
    
    // 낙관적 업데이트 (사용자 메시지 즉시 표시)
    const userMessage: Msg = {
      sender: "user",
      text: messageText,
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
            sender: "user"
          }),
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
    }
  }, [characterId, personaId, loading, clearError]);

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
    clearError,
    clearChat,
    refreshMessages,
    hasError: !!error
  };
}
