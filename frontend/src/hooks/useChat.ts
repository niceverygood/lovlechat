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
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // 메시지 불러오기 (에러 핸들링 및 성능 최적화)
  useEffect(() => {
    if (!characterId || !personaId) return;
    
    const controller = new AbortController();
    
    const loadMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat?personaId=${personaId}&characterId=${characterId}`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.ok) {
          const formattedMessages = data.messages.map((msg: any) => ({
            sender: msg.sender,
            text: msg.message,
            avatar: msg.sender === "ai" ? `/avatars/${characterId}.jpg` : undefined,
            timestamp: msg.createdAt
          }));
          
          setMessages(formattedMessages);
          if (typeof data.favor === "number") setFavor(data.favor);
        } else {
          throw new Error(data.error || '메시지 로드 실패');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Failed to load messages:', err.message);
          // 폴백 처리 - 빈 상태로 시작
          setMessages([]);
          setFavor(0);
        }
      }
    };
    
    loadMessages();
    
    return () => controller.abort();
  }, [characterId, personaId]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg.trim() || loading) return;

    const userMessage = msg.trim();
    setLoading(true);
    setInput("");
    
    // 사용자 메시지 즉시 추가 (낙관적 업데이트)
    const userMsgObj: Msg = { 
      sender: "user", 
      text: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsgObj]);

    try {
      // 최근 히스토리만 포함 (성능 최적화)
      const recentHistory = messages.slice(-3).concat([userMsgObj]);
      const requestBody = {
        personaId,
        characterId,
        message: userMessage,
        sender: "user",
        history: recentHistory.map(m => ({ ...m, message: m.text }))
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();

      if (data.ok && data.aiText) {
        const aiMsgObj: Msg = {
          sender: "ai",
          text: data.aiText,
          avatar: `/avatars/${characterId}.jpg`,
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiMsgObj]);
        
        // 호감도 변화 처리 (개선된 UX)
        if (typeof data.favorDelta === "number" && !isNaN(data.favorDelta) && data.favorDelta !== 0) {
          setFavor(prev => prev + data.favorDelta);
          
          const favorEmoji = data.favorDelta > 0 ? "💝" : "💔";
          const favorText = data.favorDelta > 0 
            ? `호감도 ${data.favorDelta} 증가! ${favorEmoji}` 
            : `호감도 ${Math.abs(data.favorDelta)} 감소 ${favorEmoji}`;
            
          setMessages(prev => [...prev, {
            sender: "system",
            text: favorText,
            timestamp: new Date().toISOString()
          }]);
        }
        
        retryCountRef.current = 0; // 성공시 재시도 카운트 리셋
      } else {
        throw new Error(data.error || "응답 생성 실패");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // 재시도 로직
      if (retryCountRef.current < MAX_RETRIES && !error.name?.includes('Abort')) {
        retryCountRef.current++;
        console.log(`재시도 중... (${retryCountRef.current}/${MAX_RETRIES})`);
        
        // 재시도 메시지 표시
        setMessages(prev => [...prev, {
          sender: "system",
          text: `연결을 재시도하고 있습니다... (${retryCountRef.current}/${MAX_RETRIES})`,
          timestamp: new Date().toISOString()
        }]);
        
        // 1초 후 재시도
        setTimeout(() => {
          setLoading(false);
          sendMessage(userMessage);
        }, 1000);
        return;
      }
      
      // 최종 실패시 폴백 응답
      const errorMsg = error.name === 'AbortError' 
        ? "요청 시간이 초과되었습니다. 다시 시도해주세요." 
        : "일시적으로 응답에 문제가 있어요. 잠시 후 다시 시도해주세요.";
        
      setMessages(prev => [...prev, {
        sender: "ai",
        text: errorMsg + " 🙏",
        avatar: `/avatars/${characterId}.jpg`,
        timestamp: new Date().toISOString()
      }]);
      
      retryCountRef.current = 0;
    } finally {
      setLoading(false);
    }
  }, [characterId, personaId, messages, loading]);

  return { 
    messages, 
    input, 
    setInput, 
    sendMessage, 
    setMessages, 
    loading, 
    favor,
    isRetrying: retryCountRef.current > 0
  };
}
