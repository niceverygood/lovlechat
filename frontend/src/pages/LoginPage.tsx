// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../firebase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      navigate("/home", { replace: true });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleBackToLanding = () => {
    navigate("/", { replace: true });
  };

  return (
    <div 
      className="flex flex-col items-center justify-center h-screen relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url('/login-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* 뒤로가기 버튼 */}
      <button
        onClick={handleBackToLanding}
        className="absolute top-8 left-8 text-white text-2xl hover:text-pink-300 transition-colors duration-300"
        style={{ zIndex: 10 }}
      >
        ← 
      </button>

      {/* 중앙 로그인 카드 */}
      <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-3xl p-12 shadow-2xl max-w-md w-full mx-8">
        <div className="text-center">
          <h1 
            className="text-4xl font-bold text-gray-800 mb-3"
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            러블챗
          </h1>
          <p 
            className="text-gray-600 mb-8 text-lg"
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            로그인하고 모든 기능을 이용해보세요
          </p>

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className={`w-full bg-pink-500 text-white px-6 py-4 rounded-full font-bold text-lg shadow-lg transition-all duration-300 ${
              isLoading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-pink-600 hover:scale-105'
            }`}
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                로그인 중...
              </div>
            ) : (
              "Google로 로그인"
            )}
          </button>

          {/* 이용약관 등 */}
          <p className="text-xs text-gray-500 mt-6 leading-relaxed">
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
          </p>
        </div>
      </div>

      {/* 장식용 그라데이션 오버레이 */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(255,64,129,0.1) 0%, transparent 70%),
            linear-gradient(45deg, rgba(255,64,129,0.05) 0%, transparent 50%, rgba(138,43,226,0.05) 100%)
          `
        }}
      />
    </div>
  );
}
