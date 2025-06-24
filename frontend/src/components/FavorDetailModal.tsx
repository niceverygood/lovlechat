import React from "react";
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';
import { FAVOR_STAGES } from '../utils/favorUtils';

// 기존 STAGES와 호환성을 위한 설명 추가
const STAGE_DESCRIPTIONS = {
  '아는사이': '새로운 인연을 맺을 준비가 되었나요?',
  '친구': '서로 웃고 떠들며 일상을 공유해요',
  '썸': '감정이 싹트며 설렘을 느껴요',
  '연인': '같이 시간을 보내며 둘만의 러브스토리를 만들어가요',
  '결혼': '오랜 신뢰와 헌신으로 단단하게 쌓아온 깊은 사랑을 축하해요'
};

export default function FavorDetailModal({
  isOpen,
  onClose,
  character,
  user,
  favor,
  days,
  relation = "아는사이"
}: {
  isOpen: boolean;
  onClose: () => void;
  character: { name: string; avatar: string };
  user: { name: string; avatar: string };
  favor: number;
  days: number;
  relation?: string;
}) {
  const [selectedStageIdx, setSelectedStageIdx] = React.useState(0);
  
  React.useEffect(() => {
    // 현재 호감도에 맞는 단계로 자동 선택
    const idx = [...FAVOR_STAGES].reverse().findIndex(s => favor >= s.min);
    setSelectedStageIdx(idx === -1 ? 0 : FAVOR_STAGES.length - 1 - idx);
  }, [favor, isOpen]);
  
  if (!isOpen) return null;
  
  const selectedStage = FAVOR_STAGES[selectedStageIdx];
  const maxFavor = FAVOR_STAGES[FAVOR_STAGES.length - 1].max;
  
  return (
    <div style={{
      position: "fixed", 
      top: 0, 
      left: 0, 
      width: "100%",
      height: "100%",
      zIndex: 3000,
      background: "#fbeaff", 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box',
      overflow: 'auto'
    }}>
      <div style={{
        background: '#fff', 
        borderRadius: 24, 
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        width: '100%', 
        maxWidth: 400, 
        minHeight: 540, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '32px 20px', 
        position: 'relative',
        margin: '0 auto',
        boxSizing: 'border-box'
    }}>
        <button onClick={onClose} style={{ position: "absolute", left: 24, top: 24, background: "none", border: "none", fontSize: 28, color: "#888", cursor: 'pointer' }}>&larr;</button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 16 }}>
          <img src={character.avatar || DEFAULT_PROFILE_IMAGE} alt={character.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff" }} onError={handleProfileImageError} />
          <span style={{ fontSize: 36, color: "#ffb3d1" }}>❤</span>
          <img src={user.avatar || DEFAULT_PROFILE_IMAGE} alt={user.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff" }} onError={handleProfileImageError} />
        </div>
        <div style={{ marginTop: 24, fontWeight: 700, fontSize: 18, color: "#444", textAlign: 'center' }}>{days}일 동안 이야기를 쌓아오고 있어요</div>
        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 20, color: "#ff4081", textAlign: 'center' }}>{selectedStage.label}</div>
        {/* 호감도 게이지 */}
        <div style={{ marginTop: 24, width: '100%', maxWidth: 320, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 8px #eee", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#ff4081", marginBottom: 8, alignSelf: 'flex-start' }}>호감도</div>
          <div style={{ width: "100%", height: 12, background: "#ffe3ef", borderRadius: 8, marginBottom: 8, position: "relative" }}>
            <div style={{
              width: `${Math.min(favor, maxFavor) / maxFavor * 100}%`,
              height: "100%",
              background: "#ff4081",
              borderRadius: 8,
              transition: "width 0.3s"
            }} />
          </div>
          <div style={{ textAlign: "right", color: "#ff4081", fontWeight: 700, width: '100%' }}>{favor} / {maxFavor}</div>
          {/* 단계별 버튼/아이콘 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, width: '100%' }}>
            {FAVOR_STAGES.map((s, idx) => {
              const unlocked = favor >= s.min;
              return (
                <button
                  key={s.label}
                  onClick={() => setSelectedStageIdx(idx)}
                  style={{
                    textAlign: "center", flex: 1, opacity: unlocked ? 1 : 0.4, background: "none", border: "none", cursor: "pointer", outline: selectedStageIdx === idx ? "2px solid #ff4081" : "none", borderRadius: 8, padding: 0
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: unlocked ? "#ffb3d1" : "#eee",
                    margin: "0 auto", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <span style={{ fontSize: 18 }}>{unlocked ? "❤" : "🔒"}</span>
                  </div>
                  <div style={{ fontSize: 13, color: unlocked ? "#ff4081" : "#bbb", fontWeight: selectedStageIdx === idx ? 700 : 400 }}>{s.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        {/* 단계별 설명 */}
        <div style={{ marginTop: 40, width: '100%', maxWidth: 320, background: "none", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8, color: '#ff4081' }}>{selectedStage.label}</div>
          <div style={{ color: "#444", fontSize: 16, marginBottom: 12 }}>{STAGE_DESCRIPTIONS[selectedStage.label as keyof typeof STAGE_DESCRIPTIONS]}</div>
          {selectedStage.min > 0 && (
            <div style={{ color: "#ff4081", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>💗 호감도 {selectedStage.min}</div>
          )}
          <button style={{ marginTop: 12, background: "#ffe3ef", color: "#ff4081", border: "none", borderRadius: 16, padding: "12px 32px", fontWeight: 700, fontSize: 18, opacity: 0.5 }} disabled>축하 카드 (준비중)</button>
        </div>
      </div>
    </div>
  );
} 