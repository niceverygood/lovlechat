// src/pages/LoginPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../firebase";

export default function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate("/home", { replace: true });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-pink-50">
      <h1 className="text-3xl font-bold mb-8">LovleChat 💘</h1>
      <button
        onClick={handleLogin}
        className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition"
      >
        Google로 로그인
      </button>
    </div>
  );
}
