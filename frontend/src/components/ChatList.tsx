import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from '../lib/openai';

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const userId = user?.uid || "guest";

  useEffect(() => {
    if (!user) {
      // 게스트: 더미 데이터 5개 랜덤
      fetch(`${API_BASE_URL}/api/chat/dummy?count=5`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) setChats(data.chats);
        });
      setPersonas([]);
    } else {
      fetch(`${API_BASE_URL}/api/chat/list?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setChats(data.chats);
      });
      fetch(`${API_BASE_URL}/api/persona?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) setPersonas(data.personas);
        });
    }
  }, [user]);

  // 현재 존재하는 멀티프로필 id만 추출 (모두 문자열로 변환)
  const validPersonaIds = personas.map(p => p.id?.toString());

  // 채팅방 나가기(삭제)
  const handleLeaveChat = async (chat: any) => {
    if (!window.confirm('정말로 이 채팅방을 나가시겠습니까?')) return;
    await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: chat.personaId, characterId: chat.characterId })
    });
    setChats(prev => prev.filter(c => !(c.characterId === chat.characterId && c.personaId === chat.personaId)));
  };

  // 구글 로그인
  const handleGoogleLogin = async () => {
    window.location.href = "/login";
  };

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: 'transparent', minHeight: '100vh', paddingTop: 0 }}>
      {/* 상단바: 채팅 타이틀 + 연필 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px 20px', marginTop: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 24, color: '#fff', letterSpacing: 1 }}>채팅</span>
        <button
          onClick={() => setEditMode(e => !e)}
          style={{ background: 'none', border: 'none', borderRadius: 8, padding: 4, marginLeft: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
          aria-label="채팅 편집"
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseOut={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.13 2.87a2.5 2.5 0 1 1 3.54 3.54l-9.19 9.19a2 2 0 0 1-.71.44l-3.13 1.09a.5.5 0 0 1-.64-.64l1.09-3.13a2 2 0 0 1 .44-.71l9.2-9.19Zm2.12-1.41a3.5 3.5 0 0 0-4.95 0l-9.2 9.19a4 4 0 0 0-.89 1.42l-1.09 3.13A1.5 1.5 0 0 0 2.5 17.5c.16 0 .33-.03.49-.09l3.13-1.09a4 4 0 0 0 1.42-.89l9.19-9.19a3.5 3.5 0 0 0 0-4.95Z" fill="#fff"/></svg>
        </button>
      </div>
      {chats.length === 0 ? (
        <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>대화 내역이 없습니다.</div>
      ) : (
        chats
          .filter(chat => user ? validPersonaIds.includes(chat.personaId?.toString()) : true)
          .map((chat) => (
          <div
              key={chat.characterId + '-' + chat.personaId}
            style={{
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 12px',
                borderBottom: '1px solid #222',
                gap: 16,
                background: editMode ? '#19171a' : 'transparent',
                position: 'relative',
                borderRadius: 14,
                margin: '0 8px 10px 8px',
                boxShadow: editMode ? '0 2px 8px #0002' : 'none',
                transition: 'background 0.2s',
                cursor: user ? (editMode ? 'default' : 'pointer') : 'pointer'
              }}
              onClick={() => {
                if (editMode) return;
                if (!user) {
                  setShowLoginModal(true);
                  return;
                }
                if (!chat.personaId) return alert('이 대화는 멀티프로필 정보가 없어 진입할 수 없습니다.');
                navigate(`/chat/${chat.characterId}?persona=${chat.personaId.toString()}`);
            }}
          >
            <img
                src={chat.profileImg || "/imgdefault.jpg"}
              alt={chat.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
            />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{chat.name}</div>
                <div style={{ color: '#aaa', fontSize: '0.95rem', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{chat.lastMessage}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: 24, minWidth: 60 }}>
                <img
                  src={chat.personaAvatar || "/imgdefault.jpg"}
                  alt={chat.personaName || "프로필"}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginBottom: 2 }}
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
                />
                <span style={{ fontSize: 12, color: '#bbb', maxWidth: 60, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.personaName || '유저프로필'}</span>
              </div>
              {editMode && user && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeaveChat(chat);
                  }}
                  style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: '#ff4081', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 15, cursor: 'pointer', zIndex: 2, boxShadow: '0 2px 8px #ff408133' }}
                >나가기</button>
              )}
            </div>
          ))
      )}
      {/* 게스트용 로그인/회원가입 모달 */}
      {showLoginModal && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#222', borderRadius: 18, minWidth: 260, maxWidth: 320, padding: '36px 24px 28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 18 }}>로그인 필요</div>
            <div style={{ color: '#bbb', fontSize: 16, marginBottom: 24 }}>로그인 또는 회원가입 후 대화를 시작할 수 있습니다.</div>
            <button
              onClick={handleGoogleLogin}
              style={{ background: '#fff', color: '#222', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 17, width: '100%', cursor: 'pointer', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <img src="/google.svg" alt="구글" style={{ width: 22, height: 22, marginRight: 6 }} />
              구글로 로그인
            </button>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{ background: 'none', color: '#bbb', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 500, fontSize: 15, width: '100%', cursor: 'pointer', marginTop: 8 }}
            >닫기</button>
          </div>
        </div>
      )}
    </div>
  );
} 