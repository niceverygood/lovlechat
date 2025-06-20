// src/App.tsx
import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import IntroPage from './pages/IntroPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import ProtectedRoute from './components/ProtectedRoute';
import CharacterCreatePage from './pages/CharacterCreatePage';
import ForYouPage from './pages/ForYouPage';
import MyPage from './pages/MyPage';
import CharacterDetailPage from './pages/CharacterDetailPage';
import HeartShopPage from './pages/HeartShopPage';
import { setGuestMode, clearGuestMode } from './utils/guestMode';

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const wasLoggedIn = useRef(false);

  // 로그인/로그아웃 상태 감지 및 게스트 모드 처리
  useEffect(() => {
    if (loading) return;

    if (user) {
      // 로그인 상태
      console.log('로그인 상태 - 게스트 모드 해제');
      clearGuestMode();
      wasLoggedIn.current = true;
    } else {
      // 로그아웃 상태
      if (wasLoggedIn.current) {
        // 이전에 로그인되어 있었다면 (로그아웃된 상황)
        console.log('로그아웃 감지 - 게스트 모드로 전환');
        setGuestMode();
        navigate('/home', { replace: true });
        wasLoggedIn.current = false;
      } else {
        // 처음 방문하거나 게스트 상태
        const currentMode = localStorage.getItem('userMode');
        if (!currentMode || currentMode !== 'guest') {
          console.log('자동으로 게스트 모드 설정');
          setGuestMode();
        }
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div>로딩 중…</div>;
  }

  // 게스트 모드 확인
  const isGuestMode = localStorage.getItem('userMode') === 'guest';
  
  // 디버깅 로그
  console.log('App.js 상태:', {
    user: !!user,
    isGuestMode,
    userMode: localStorage.getItem('userMode')
  });

  return (
    <Routes>
      {/* 메인 페이지 - 바로 홈으로 이동 */}
      <Route
        path="/"
        element={<Navigate to="/home" replace />}
      />
      
      {/* 로그인 페이지 */}
      <Route
        path="/login"
        element={!user ? <LoginPage /> : <Navigate to="/home" replace />}
      />
      
      <Route
        path="/intro"
        element={user ? <IntroPage /> : <Navigate to="/" replace />}
      />
      
      {/* 홈 페이지 - 게스트도 접근 가능 */}
      <Route
        path="/home"
        element={user || isGuestMode ? <HomePage /> : <Navigate to="/" replace />}
      />
      
      {/* 채팅 - 게스트도 접근 가능 (제한 적용) */}
      <Route 
        path="/chat/:id" 
        element={user || isGuestMode ? <ChatPage /> : <Navigate to="/" replace />} 
      />
      
      <Route path="/character-create" element={<CharacterCreatePage />} />
      
      {/* For You 페이지 - 게스트도 접근 가능 (제한 적용) */}
      <Route
        path="/for-you"
        element={user || isGuestMode ? <ForYouPage /> : <Navigate to="/" replace />}
      />
      
      {/* 마이페이지 - 로그인 필수 */}
      <Route
        path="/my"
        element={
          <ProtectedRoute>
            <MyPage />
          </ProtectedRoute>
        }
      />
      
      <Route 
        path="/character/:id" 
        element={user || isGuestMode ? <CharacterDetailPage /> : <Navigate to="/" replace />} 
      />
      
      {/* 하트샵 - 로그인 필수 */}
      <Route 
        path="/heart-shop" 
        element={
          <ProtectedRoute>
            <HeartShopPage />
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
