import React, { useState, useEffect, useMemo } from 'react';
import { getFavorStage, getFavorEmoji, formatFavorChange } from '../utils/favorUtils';
import './FavorBubble.css';

interface FavorBubbleProps {
  favorChange: number;
  currentFavor: number;
  onAnimationEnd?: () => void;
}

const FavorBubble: React.FC<FavorBubbleProps> = ({ favorChange, currentFavor, onAnimationEnd }) => {
  const [isVisible, setIsVisible] = useState(true);

  // 성능 최적화: 메모이제이션
  const stage = useMemo(() => getFavorStage(currentFavor), [currentFavor]);
  const isPositive = useMemo(() => favorChange > 0, [favorChange]);
  const changeText = useMemo(() => formatFavorChange(favorChange), [favorChange]);
  const emoji = useMemo(() => getFavorEmoji(favorChange), [favorChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onAnimationEnd) {
        setTimeout(onAnimationEnd, 300); // 페이드아웃 애니메이션 시간
      }
    }, 3000); // 3초 후 사라짐

    return () => clearTimeout(timer);
  }, [onAnimationEnd]);

  return (
    <div 
      className={`favor-bubble ${isVisible ? 'visible' : 'hidden'} ${isPositive ? 'positive' : 'negative'}`}
    >
      {/* 말풍선 */}
      <div className={`favor-bubble-content ${isPositive ? 'positive' : 'negative'}`}>
        {/* 상단 화살표 */}
        <div className={`favor-bubble-arrow top ${isPositive ? 'positive' : 'negative'}`} />
        
        {/* 호감도 변화 텍스트 */}
        <div className="favor-bubble-text">
          <span className="favor-emoji">{emoji}</span>
          <div className="favor-details">
            <div className="favor-change">호감도 {changeText}</div>
            <div 
              className="favor-stage"
              style={{ color: stage.color }}
            >
              {stage.label} ({currentFavor})
            </div>
          </div>
        </div>

        {/* 하단 화살표 */}
        <div className={`favor-bubble-arrow bottom ${isPositive ? 'positive' : 'negative'}`} />
      </div>
    </div>
  );
};

export default FavorBubble; 