import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';

interface Character {
  id: number;
  name: string;
  profileImg: string;
  age?: number;
  job?: string;
  info?: string;
  habit?: string;
}

interface ChatHeaderProps {
  character: Character;
  onProfileClick: () => void;
  onMoreClick: () => void;
}

const ChatHeader = memo(({ character, onProfileClick, onMoreClick }: ChatHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      background: "var(--color-card)", 
      padding: "12px 20px", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      borderBottom: "1px solid var(--color-border)", 
      position: "sticky", 
      top: 0, 
      zIndex: 10 
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button 
          onClick={() => navigate('/home')} 
          style={{ 
            background: "none", 
            border: "none", 
            fontSize: 24, 
            marginRight: 12, 
            cursor: "pointer", 
            color: "#fff" 
          }}
          aria-label="뒤로가기"
        >
          &larr;
        </button>
        <img
          src={character.profileImg}
          alt={character.name}
          style={{ 
            width: 40, 
            height: 40, 
            borderRadius: "50%", 
            marginRight: 12, 
            cursor: "pointer",
            objectFit: "cover"
          }}
          onClick={onProfileClick}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/imgdefault.jpg";
          }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{character.name}</div>
          <div style={{ color: "#888", fontSize: 14 }}>
            {character.age ? `${character.age}살` : "나이 비공개"} · {character.job || "직업 비공개"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <span 
          style={{ fontSize: 20, cursor: "pointer" }} 
          onClick={onMoreClick}
          role="button"
          aria-label="더보기 메뉴"
        >
          ⋮
        </span>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader; 