// src/pages/HomePage.tsx
import React from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import FloatingActionButton from "../components/FloatingActionButton";
import ChatList from "../components/ChatList";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  const handleCreateCharacter = () => {
    navigate("/character-create");
  };
  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: 0 }}>
      <ChatList />
      </div>
      <FloatingActionButton onClick={handleCreateCharacter} />
      <BottomNav />
    </div>
  );
}
