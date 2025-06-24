import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MessageBubble from './MessageBubble';

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

interface VirtualizedMessageListProps {
  messages: Message[];
  character: any;
  persona: any;
  onProfileClick: (profile: any) => void;
  loading?: boolean;
}

const ITEM_HEIGHT = 80; // 메시지 평균 높이
const BUFFER_SIZE = 5; // 위아래 버퍼 메시지 수

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  character,
  persona,
  onProfileClick,
  loading
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // 컨테이너 높이 측정
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 보이는 메시지 범위 계산
  const visibleRange = useMemo(() => {
    if (!containerHeight) return { start: 0, end: messages.length };

    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT);
    const end = Math.min(messages.length, start + visibleCount + BUFFER_SIZE * 2);

    return { start, end };
  }, [scrollTop, containerHeight, messages.length]);

  // 보이는 메시지들만 렌더링
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end).map((msg, index) => ({
      ...msg,
      virtualIndex: visibleRange.start + index,
      style: {
        position: 'absolute' as const,
        top: (visibleRange.start + index) * ITEM_HEIGHT,
        width: '100%',
        height: ITEM_HEIGHT,
      }
    }));
  }, [messages, visibleRange]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!isAutoScrolling) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [isAutoScrolling]);

  // 맨 아래로 스크롤
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      setIsAutoScrolling(true);
      const maxScrollTop = messages.length * ITEM_HEIGHT - containerHeight;
      containerRef.current.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
      
      // 자동 스크롤 플래그 리셋
      setTimeout(() => setIsAutoScrolling(false), 100);
    }
  }, [messages.length, containerHeight]);

  // 새 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      // 사용자가 맨 아래 근처에 있을 때만 자동 스크롤
      const maxScrollTop = Math.max(0, messages.length * ITEM_HEIGHT - containerHeight);
      const isNearBottom = scrollTop > maxScrollTop - 200;
      
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages.length, scrollToBottom, scrollTop, containerHeight]);

  return (
    <div
      ref={containerRef}
      className="messages-container"
      style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        padding: '0 0 16px 0',
      }}
      onScroll={handleScroll}
    >
      {/* 전체 높이를 위한 스페이서 */}
      <div style={{ height: messages.length * ITEM_HEIGHT, position: 'relative' }}>
        {/* 보이는 메시지들만 렌더링 */}
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...msg.style,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <MessageBubble
              message={{
                sender: msg.sender,
                text: msg.message,
                avatar: (msg.sender === 'ai' || msg.sender === 'character')
                  ? msg.characterProfileImg || character.profileImg
                  : persona.avatar,
                characterName: msg.characterName,
                characterProfileImg: msg.characterProfileImg,
                characterAge: msg.characterAge,
                characterJob: msg.characterJob
              }}
              onProfileClick={() => {
                if (msg.sender === 'ai' || msg.sender === 'character') {
                  onProfileClick({
                    id: character.id.toString(),
                    name: msg.characterName || character.name,
                    avatar: msg.characterProfileImg || character.profileImg,
                    age: (msg.characterAge || character.age)?.toString(),
                    job: msg.characterJob || character.job,
                    info: character.info,
                    habit: character.habit
                  });
                } else if (msg.sender === 'user') {
                  onProfileClick({
                    id: persona.id || '',
                    name: persona.name,
                    avatar: persona.avatar,
                    gender: persona.gender,
                    age: persona.age,
                    job: persona.job,
                    info: persona.info,
                    habit: persona.habit
                  });
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* 로딩 인디케이터 */}
      {loading && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-card)',
          color: '#999',
          borderRadius: 18,
          padding: '12px 16px',
          fontSize: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid var(--color-border)',
        }}>
          <span className="chat-loading-dots">●●●</span>
        </div>
      )}
    </div>
  );
}; 