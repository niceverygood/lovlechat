import React, { memo } from 'react';

interface Stage {
  label: string;
  min: number;
  desc: string;
  icon: string;
}

interface ChatStatusBarProps {
  favor: number;
  onFavorClick: () => void;
}

const STAGES: Stage[] = [
  { label: "아는사이", min: 0, desc: "새로운 인연을 맺을 준비가 되었나요?", icon: "🤝" },
  { label: "친구", min: 20, desc: "서로 웃고 떠들며 일상을 공유해요", icon: "😊" },
  { label: "썸", min: 50, desc: "감정이 싹트며 설렘을 느껴요", icon: "💓" },
  { label: "연인", min: 400, desc: "같이 시간을 보내며 둘만의 러브스토리를 만들어가요", icon: "💑" },
  { label: "결혼", min: 4000, desc: "오랜 신뢰와 헌신으로 단단하게 쌓아온 깊은 사랑을 축하해요", icon: "💍" },
];

const ChatStatusBar = memo(({ favor, onFavorClick }: ChatStatusBarProps) => {
  const currentStageIdx = [...STAGES].reverse().findIndex(s => favor >= s.min);
  const stageIdx = currentStageIdx === -1 ? 0 : STAGES.length - 1 - currentStageIdx;

  return (
    <div style={{ 
      background: "var(--color-card)", 
      display: "flex", 
      alignItems: "center", 
      borderBottom: "1.5px solid var(--color-point)", 
      padding: "0 0 0 0", 
      position: "sticky", 
      top: 56, 
      zIndex: 9, 
      minHeight: 36, 
      justifyContent: 'space-between' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
        {STAGES.map((s, idx) => (
          <div key={s.label} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            opacity: idx === stageIdx ? 1 : 0.4, 
            margin: '0 2px' 
          }}>
            <span style={{ fontSize: 16, marginRight: 2 }}>{s.icon}</span>
            <span style={{ 
              fontWeight: idx === stageIdx ? 700 : 500, 
              color: idx === stageIdx ? '#ff4081' : '#bbb', 
              fontSize: 14 
            }}>
              {s.label}
            </span>
            {idx < STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
          </div>
        ))}
      </div>
      <button
        style={{ 
          marginRight: 16, 
          background: 'none', 
          border: 'none', 
          color: '#ff4081', 
          fontWeight: 700, 
          fontSize: 15, 
          cursor: 'pointer', 
          padding: '4px 12px', 
          borderRadius: 8, 
          transition: 'background 0.2s' 
        }}
        onClick={onFavorClick}
        aria-label={`현재 호감도 ${favor}점`}
      >
        호감도: <span style={{ color: '#ff4081', fontWeight: 700 }}>{favor}점</span>
      </button>
    </div>
  );
});

ChatStatusBar.displayName = 'ChatStatusBar';

export default ChatStatusBar; 