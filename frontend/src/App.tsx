// src/App.tsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
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

// Loading component
const PageLoading = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--color-bg)',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 600
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #333',
        borderTop: '3px solid #ff4081',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>로딩 중...</div>
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
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg)',
          color: '#ff4081',
          fontSize: '18px',
          fontWeight: 600,
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>페이지 로딩 중 오류가 발생했습니다.</div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#ff4081',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
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
  const { user, loading, authReady } = useAuth();

  if (!authReady || loading) {
    return <PageLoading />;
  }

  return (
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
  );
}

export default App;
