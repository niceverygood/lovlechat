import React, { memo, useMemo } from 'react';
import { FAVOR_STAGES } from '../utils/favorUtils';

interface ChatStatusBarProps {
  favor: number;
  onFavorClick: () => void;
}

// 아이콘 매핑 (기존 STAGES와 호환성을 위해)
const STAGE_ICONS = {
  '아는사이': '🤝',
  '친구': '😊',
  '썸': '💓',
  '연인': '💑',
  '결혼': '💍'
};

const ChatStatusBar = memo(({ favor, onFavorClick }: ChatStatusBarProps) => {
  // 성능 최적화: 현재 단계 인덱스 계산을 메모이제이션
  const stageIdx = useMemo(() => {
    const currentStageIdx = [...FAVOR_STAGES].reverse().findIndex(s => favor >= s.min);
    return currentStageIdx === -1 ? 0 : FAVOR_STAGES.length - 1 - currentStageIdx;
  }, [favor]);

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
        {FAVOR_STAGES.map((s, idx) => (
          <div key={s.label} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            opacity: idx === stageIdx ? 1 : 0.4, 
            margin: '0 2px' 
          }}>
            <span style={{ fontSize: 16, marginRight: 2 }}>{STAGE_ICONS[s.label as keyof typeof STAGE_ICONS]}</span>
            <span style={{ 
              fontWeight: idx === stageIdx ? 700 : 500, 
              color: idx === stageIdx ? '#ff4081' : '#bbb', 
              fontSize: 14 
            }}>
              {s.label}
            </span>
            {idx < FAVOR_STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
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