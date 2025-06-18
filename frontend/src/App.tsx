// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>로딩 중…</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={!user ? <LoginPage /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/intro"
          element={user ? <IntroPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/character-create" element={<CharacterCreatePage />} />
        <Route
          path="/for-you"
          element={
            <ProtectedRoute>
              <ForYouPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />
        <Route path="/character/:id" element={<CharacterDetailPage />} />
        <Route path="/heart-shop" element={<HeartShopPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
