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

  // 메시지 불러오기
  useEffect(() => {
    if (!characterId || !personaId) return;
    fetch(`${API_BASE_URL}/api/chat?personaId=${personaId}&characterId=${characterId}`)
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
      });
  }, [characterId, personaId]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return;

    setLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: msg }]);
    const userMsg = msg;
    setInput("");

    try {
      const history = messages.slice(-9).concat([{ sender: "user", text: msg }]);
      const requestBody = {
        personaId,
        characterId,
        message: userMsg,
        sender: "user",
        history: history.map(m => ({ ...m, message: m.text }))
      };
      console.log('Sending request:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
      const data = await response.json();
      console.log('Received response:', data);

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
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  }, [input, characterId, personaId, messages]);

  return { messages, input, setInput, sendMessage, setMessages, loading, favor };
}
