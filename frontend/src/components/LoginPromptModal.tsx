import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../firebase";
import { clearGuestMode } from "../utils/guestMode";

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function LoginPromptModal({ isOpen, onClose, message }: LoginPromptModalProps) {
  const navigate = useNavigate();
  const [isLogging, setIsLogging] = useState(false);

  const handleLogin = async () => {
    setIsLogging(true);
    try {
      await signInWithGoogle();
      clearGuestMode(); // 게스트 모드 해제
      onClose();
      // 페이지 새로고침으로 로그인 상태 반영
      window.location.reload();
    } catch (e) {
      console.error('로그인 실패:', e);
      setIsLogging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '24px',
        padding: '40px 32px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          ×
        </button>

        {/* 타이틀 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#fff',
            margin: 0,
            marginRight: '8px',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            러블챗
          </h2>
          <span style={{
            fontSize: '28px',
            color: '#ff4081',
          }}>
            💖
          </span>
        </div>

        {/* 설명 텍스트 */}
        <p style={{
          fontSize: '18px',
          color: '#bbb',
          marginBottom: '32px',
          lineHeight: '1.5',
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          상상하던 사랑이 현실이 되는 공간
        </p>

        {/* 추가 메시지 */}
        {message && (
          <p style={{
            fontSize: '16px',
            color: '#ff4081',
            marginBottom: '24px',
            lineHeight: '1.5',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            {message}
          </p>
        )}

        {/* Google 로그인 버튼 */}
        <button
          onClick={handleLogin}
          disabled={isLogging}
          style={{
            width: '100%',
            background: '#fff',
            color: '#333',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 24px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: isLogging ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            opacity: isLogging ? 0.7 : 1,
            transition: 'all 0.2s',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {isLogging ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #666',
                borderTop: '2px solid #333',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: '12px',
              }} />
              로그인 중...
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                style={{ marginRight: '12px' }}
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 로그인 하기
            </>
          )}
        </button>

        {/* 이용약관 및 개인정보취급방침 */}
        <p style={{
          fontSize: '12px',
          color: '#666',
          lineHeight: '1.4',
          margin: 0,
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          로그인을 위해{' '}
          <a
            href="https://www.notion.so/218b12877044803796fcf0ab0dbd9955?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#ff4081',
              textDecoration: 'underline',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b9d'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#ff4081'}
          >
            이용약관
          </a>
          {' '}및{' '}
          <a
            href="https://www.notion.so/218b12877044802594a5de94e99731c6?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#ff4081',
              textDecoration: 'underline',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b9d'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#ff4081'}
          >
            개인정보취급방침
          </a>
          에 동의하게 됩니다.
        </p>

        {/* 스피너 애니메이션 CSS */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
} 