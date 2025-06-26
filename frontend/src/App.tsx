// src/App.tsx
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useToast } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

// Lazy load components for code splitting
const IntroPage = lazy(() => import('./pages/IntroPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ForYouPage = lazy(() => import('./pages/ForYouPage'));
const MyPage = lazy(() => import('./pages/MyPage'));
const MyPageOptimized = lazy(() => import('./pages/MyPageOptimized'));
const HeartShopPage = lazy(() => import('./pages/HeartShopPage'));
const CharacterDetailPage = lazy(() => import('./pages/CharacterDetailPage'));
const CharacterCreatePage = lazy(() => import('./pages/CharacterCreatePage'));
const ProfileDetailPage = lazy(() => import('./pages/ProfileDetailPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const MonitoringDashboard = lazy(() => import('./pages/MonitoringDashboard'));

// Enhanced Loading component with better styling
const PageLoading = ({ message = '로딩 중...' }: { message?: string }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a', // 명시적인 배경색
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 600,
    zIndex: 9999
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
      padding: '32px',
      backgroundColor: '#2a2a2a',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid #333333',
        borderTop: '4px solid #ff4081',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
        {message}
      </div>
      <div style={{ 
        fontSize: '14px', 
        color: '#b0b0b0', 
        textAlign: 'center',
        maxWidth: '280px'
      }}>
        Firebase 초기화 중입니다...<br />
        잠시만 기다려주세요.
      </div>
    </div>
  </div>
);

// Error Boundary for lazy components
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ff4081',
          fontSize: '18px',
          fontWeight: 600,
          zIndex: 9999
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '32px',
            backgroundColor: '#2a2a2a',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <div>⚠️ 페이지 로딩 중 오류가 발생했습니다</div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: '#ff4081',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for lazy loaded pages
const LazyPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyErrorBoundary>
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  </LazyErrorBoundary>
);

function App() {
  const { user, loading, authReady, error, isGuest } = useAuth();
  const { ToastContainer, warning, error: showError, success } = useToast();

  // Firebase 에러 처리
  useEffect(() => {
    if (error && authReady) {
      if (error.includes('시간이 초과')) {
        warning('Firebase 연결이 지연되고 있습니다. Guest 모드로 계속 진행합니다.', 6000);
      } else {
        showError('Firebase 인증 서비스에 일시적인 문제가 있습니다. Guest 모드로 진행합니다.', 5000);
      }
    }
  }, [error, authReady, warning, showError]);

  // Guest 모드 안내
  useEffect(() => {
    if (isGuest && authReady) {
      const timer = setTimeout(() => {
        success('Guest 모드로 앱을 사용할 수 있습니다. 로그인하시면 더 많은 기능을 이용하실 수 있습니다.', 8000);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isGuest, authReady, success]);

  // 초기 로딩 중
  if (!authReady) {
    return (
      <>
        <PageLoading message="앱 초기화 중..." />
        <ToastContainer />
      </>
    );
  }

  // Auth 처리 중
  if (loading) {
    return (
      <>
        <PageLoading message="인증 확인 중..." />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/intro" 
              element={
                <LazyPageWrapper>
                  <IntroPage />
                </LazyPageWrapper>
              } 
            />
            <Route 
              path="/login" 
              element={
                <LazyPageWrapper>
                  <LoginPage />
                </LazyPageWrapper>
              } 
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <HomePage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/for-you"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <ForYouPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <MyPageOptimized />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-original"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <MyPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/heart-shop"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <HeartShopPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/character/:id"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <CharacterDetailPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/character-create"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <CharacterCreatePage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <ProfileDetailPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:personaId/:characterId"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <ChatPage />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <ProtectedRoute>
                  <LazyPageWrapper>
                    <MonitoringDashboard />
                  </LazyPageWrapper>
                </ProtectedRoute>
              }
            />

            {/* Redirect root to intro for non-authenticated users */}
            <Route
              path="*"
              element={
                user ? <Navigate to="/" replace /> : <Navigate to="/intro" replace />
              }
            />
          </Routes>
        </div>
      </Router>
      
      {/* Toast Container */}
      <ToastContainer />
    </>
  );
}

export default App;
