// src/pages/HomePage.tsx
import React, { useState } from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import FloatingActionButton from "../components/FloatingActionButton";
import ChatList from "../components/ChatList";
import CustomAlert from "../components/CustomAlert";
import LoginPromptModal from "../components/LoginPromptModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleCreateCharacter = () => {
    if (!user) {
      // 로그인하지 않은 경우 로그인 모달 표시
      setShowLoginModal(true);
    } else {
      // 로그인한 경우 캐릭터 생성 확인 모달 표시
      setShowCreateAlert(true);
    }
  };

  const handleConfirmCreate = () => {
    setShowCreateAlert(false);
    navigate("/character-create");
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: 0 }}>
        <ChatList />
      </div>
      <FloatingActionButton onClick={handleCreateCharacter} />
      <BottomNav />
      <CustomAlert
        open={showCreateAlert}
        title="새로운 캐릭터 만들기"
        message="새로운 캐릭터를 만드시겠습니까?"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowCreateAlert(false)}
        confirmText="만들기"
        cancelText="취소"
      />
      
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="캐릭터를 만들려면 로그인이 필요합니다."
      />
    </div>
  );
}
