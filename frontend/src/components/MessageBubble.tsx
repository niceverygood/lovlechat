import React from "react";
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';
import OptimizedImage from './OptimizedImage';

export interface Msg {
  sender: "user" | "ai" | "character";
  text: string;
  message?: string; // 백워드 호환성을 위해 추가
  avatar?: string;
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
}

interface Props {
  message: Msg;
  onProfileClick?: () => void;
}

// 행동묘사와 대사를 파싱하는 함수
function parseMessageText(text: string) {
  // *텍스트* 패턴을 찾아서 행동묘사로 변환
  const parts = text.split(/(\*[^*]+\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      // 행동묘사 스타일
      const actionText = part.slice(1, -1); // *제거
      return (
        <span
          key={index}
          style={{
            fontStyle: 'italic',
            color: '#9575cd',
            fontSize: '15px',
            fontWeight: 500,
            opacity: 0.95,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5), 0 0 4px rgba(255, 255, 255, 0.4)'
          }}
        >
          {actionText}
        </span>
      );
    } else {
      // 일반 대사 스타일
      return (
        <span
          key={index}
          style={{
            fontWeight: 400,
            lineHeight: '1.4'
          }}
        >
          {part}
        </span>
      );
    }
  });
}

const MessageBubble = React.memo<Props>(({ message, onProfileClick }) => {
  const isUser = message.sender === "user";
  const isCharacter = message.sender === "character" || message.sender === "ai";
  
  return (
    <div style={{ 
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row', 
      alignItems: 'flex-end', 
      marginBottom: 10
    }}>
      {isUser && message.avatar && (
        <OptimizedImage
          src={message.avatar || DEFAULT_PROFILE_IMAGE}
          alt="me"
          style={{ width: 40, height: 40, borderRadius: '50%', marginLeft: 10, background: '#222', objectFit: 'cover', cursor: onProfileClick ? 'pointer' : 'default', border: '2px solid #fff' }}
          onClick={onProfileClick}
        />
      )}
      {isCharacter && message.avatar && (
        <OptimizedImage
          src={message.avatar || DEFAULT_PROFILE_IMAGE}
          alt="character"
          style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 10, background: '#222', objectFit: 'cover', cursor: onProfileClick ? 'pointer' : 'default', border: '2px solid #fff' }}
          onClick={onProfileClick}
        />
      )}
      <div
        style={{
          maxWidth: 320,
          padding: isUser ? '13px 18px' : '13px 18px',
          borderRadius: 18,
          background: isUser ? '#ff4081' : 'rgba(255,255,255,0.08)',
          color: isUser ? '#fff' : '#fff',
          fontSize: 17,
          fontWeight: 400,
          marginLeft: isUser ? 0 : 4,
          marginRight: isUser ? 4 : 0,
          boxShadow: isUser ? '0 2px 8px rgba(255,64,129,0.08)' : '0 2px 8px rgba(0,0,0,0.10)',
          border: isUser ? 'none' : '1.5px solid #fff2',
          wordBreak: 'break-word',
        }}
      >
        {parseMessageText(message.text)}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 메시지 내용과 프로필 클릭 핸들러가 같으면 리렌더링 방지
  return (
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.sender === nextProps.message.sender &&
    prevProps.message.avatar === nextProps.message.avatar &&
    prevProps.onProfileClick === nextProps.onProfileClick
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
