import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isGuestMode } from "../utils/guestMode";
import LoginPromptModal from "./LoginPromptModal";

const navItems = [
  {
    label: "친구",
    path: "/home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/>
      </svg>
    ),
  },
  {
    label: "추천",
    path: "/for-you",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"/>
      </svg>
    ),
  },
  {
    label: "MY",
    path: "/my",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const current = window.location.pathname;
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleNavClick = (path: string) => {
    // 게스트 모드에서 마이페이지 접근 제한
    if (isGuestMode() && path === '/my') {
      setShowLoginModal(true);
      return;
    }
    
    navigate(path);
  };
  const navStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 0,
    zIndex: 1000,
    background: 'var(--color-card, #222)',
    boxShadow: '0 -2px 16px rgba(0,0,0,0.13)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 0',
  };
  return (
    <>
      <nav style={navStyle}>
        {navItems.map((item) => {
          const isActive = current === item.path;
          return (
            <div
              key={item.label}
              onClick={() => handleNavClick(item.path)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                color: isActive ? "#FFFFFF" : "#ABABAB",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                flex: 1,
                gap: 2,
                padding: "4px 0",
              }}
            >
              <div style={{ display: "flex", height: 32, alignItems: "center", justifyContent: "center" }}>
                {item.icon}
              </div>
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <LoginPromptModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        message="마이페이지는 로그인 후 이용할 수 있습니다."
      />
    </>
  );
} 