// src/pages/IntroPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function IntroPage() {
  const nav = useNavigate();
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white p-4">
      <img
        src="/character1.png"
        alt="대표 캐릭터"
        className="w-40 h-40 mb-4"
      />
      <h2 className="text-xl mb-6">“나랑 대화해볼래?”</h2>
      <button
        onClick={() => nav("/home", { replace: true })}
        className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition"
      >
        시작하기
      </button>
    </div>
  );
}
