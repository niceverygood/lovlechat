import { useCallback, useEffect, useState } from "react";
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
}

export function useChat(characterId: string, personaId: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [favor, setFavor] = useState(0);

  // 메시지 불러오기 (에러 핸들링 및 성능 최적화)
  useEffect(() => {
    if (!characterId || !personaId) return;
    
    const controller = new AbortController();
    
    fetch(`${API_BASE_URL}/api/chat?personaId=${personaId}&characterId=${characterId}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setMessages(
            data.messages.map((msg: any) => ({
              sender: msg.sender,
              text: msg.message,
              avatar: msg.sender === "ai" ? `/avatars/${characterId}.jpg` : undefined,
            }))
          );
          if (typeof data.favor === "number") setFavor(data.favor);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('Failed to load messages:', err);
          // 폴백 데이터 설정
          setMessages([]);
          setFavor(0);
        }
      });
    
    return () => controller.abort();
  }, [characterId, personaId]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return;

    setLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: msg }]);
    const userMsg = msg;
    setInput("");

    try {
      const history = messages.slice(-5).concat([{ sender: "user", text: msg }]); // 히스토리 줄임 (9->5)
      const requestBody = {
        personaId,
        characterId,
        message: userMsg,
        sender: "user",
        history: history.map(m => ({ ...m, message: m.text }))
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.ok) {
        if (data.aiText) {
          setMessages((prev) => [
            ...prev,
            {
              sender: "ai",
              text: data.aiText,
              avatar: `/avatars/${characterId}.jpg`,
            },
          ]);
        }
        if (typeof data.favorDelta === "number" && !isNaN(data.favorDelta) && data.favorDelta !== 0) {
          setFavor((prev) => prev + data.favorDelta);
          setMessages((prev) => [
            ...prev,
            {
              sender: "system",
              text: data.favorDelta > 0 ? `호감도 ${data.favorDelta} 증가!` : `호감도 ${-data.favorDelta} 하락!`,
            },
          ]);
        }
      } else {
        console.error("Failed to send message:", data.error);
        // 에러시 폴백 응답 추가
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "죄송해요, 일시적으로 응답에 문제가 있어요. 잠시 후 다시 시도해주세요.",
            avatar: `/avatars/${characterId}.jpg`,
          },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // 네트워크 에러시 폴백 응답
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "연결에 문제가 있어요. 네트워크 상태를 확인하고 다시 시도해주세요.",
          avatar: `/avatars/${characterId}.jpg`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [characterId, personaId, messages]); // input 제거 (불필요한 의존성)

  return { messages, input, setInput, sendMessage, setMessages, loading, favor };
}
