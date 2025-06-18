import React from "react";

export default function FloatingActionButton({ onClick }: { onClick?: () => void }) {
  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 110, // 하단 내비게이션과 더 여유 있게 띄우기
    zIndex: 1100,
    width: '90%',
    maxWidth: 320,
    height: 54,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#ff4081',
    color: '#fff',
    border: 'none',
    borderRadius: 28,
    fontWeight: 700,
    fontSize: 20,
    boxShadow: '0 2px 8px #ff408155',
    cursor: 'pointer',
  };

  return (
    <button
      onClick={onClick}
      style={fabStyle}
      aria-label="캐릭터 직접 만들기"
    >
      캐릭터 직접 만들기
    </button>
  );
} 