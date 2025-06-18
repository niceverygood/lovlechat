import { useCallback, useState } from "react";

export interface Msg {
  sender: "user" | "ai";
  text: string;
  avatar?: string;
}

export function useChat(characterId: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: input }]);
    setInput("");

    // Next.js API Route로 메시지 전송
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      {
        sender: "ai",
        text: data.aiText,
        avatar: `/avatars/${characterId}.jpg`,
      },
    ]);
  }, [input, characterId]);

  return { messages, input, setInput, sendMessage };
} 