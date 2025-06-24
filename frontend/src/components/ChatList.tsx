import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from '../lib/openai';
import CustomAlert from './CustomAlert';
import LoginPromptModal from './LoginPromptModal';
import { isGuestMode } from '../utils/guestMode';
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const userId = user?.uid || "guest";
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');

  useEffect(() => {
    if (isGuestMode()) {
      // 게스트: 실제 DB 데이터로 채팅목록 5개 생성
      console.log('게스트 모드: 채팅목록 생성 중...');
      fetch(`${API_BASE_URL}/api/chat/dummy?count=5`)
        .then(res => res.json())
        .then(data => {
          console.log('게스트 채팅목록 데이터:', data);
          if (data.ok) setChats(data.chats || []);
        })
        .catch(error => {
          console.error('게스트 채팅목록 로드 실패:', error);
        });
      setPersonas([]);
    } else if (user) {
      fetch(`${API_BASE_URL}/api/chat/list?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setChats(data.chats || []);
      });
      fetch(`${API_BASE_URL}/api/persona?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) setPersonas(data.personas || []);
        });
    }
  }, [user]);

  // 현재 존재하는 멀티프로필 id만 추출 (모두 문자열로 변환)
  const validPersonaIds = (personas || []).map(p => p.id?.toString());

  // 채팅방 나가기(삭제)
  const handleLeaveChat = async (chat: any) => {
    if (!window.confirm('정말로 이 채팅방을 나가시겠습니까?')) return;
    await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: chat.personaId, characterId: chat.characterId })
    });
    setChats(prev => prev.filter(c => !(c.characterId === chat.characterId && c.personaId === chat.personaId)));
  };

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: 'transparent', minHeight: '100vh', paddingTop: 0 }}>
      {/* 상단바: 채팅 타이틀 + 연필 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px 20px', marginTop: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 24, color: '#fff', letterSpacing: 1 }}>채팅</span>
        {!isGuestMode() && (
          <button
            onClick={() => setEditMode(e => !e)}
            style={{ background: 'none', border: 'none', borderRadius: 8, padding: 4, marginLeft: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
            aria-label="채팅 편집"
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseOut={e => (e.currentTarget.style.background = 'none')}
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.13 2.87a2.5 2.5 0 1 1 3.54 3.54l-9.19 9.19a2 2 0 0 1-.71.44l-3.13 1.09a.5.5 0 0 1-.64-.64l1.09-3.13a2 2 0 0 1 .44-.71l9.2-9.19Zm2.12-1.41a3.5 3.5 0 0 0-4.95 0l-9.2 9.19a4 4 0 0 0-.89 1.42l-1.09 3.13A1.5 1.5 0 0 0 2.5 17.5c.16 0 .33-.03.49-.09l3.13-1.09a4 4 0 0 0 1.42-.89l9.19-9.19a3.5 3.5 0 0 0 0-4.95Z" fill="#fff"/></svg>
          </button>
        )}
      </div>
      {(chats || []).length === 0 ? (
        <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>대화 내역이 없습니다.</div>
      ) : (
        (chats || [])
          .filter(chat => isGuestMode() ? true : validPersonaIds.includes(chat.personaId?.toString()))
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
                cursor: editMode ? 'default' : 'pointer'
              }}
              onClick={() => {
                if (editMode) return;
                if (isGuestMode()) {
                  console.log('게스트 모드에서 채팅 클릭 - 로그인 모달 표시');
                  setShowLoginModal(true);
                  return;
                }
                if (!chat.personaId) {
                  setAlertTitle('입장 불가');
                  setAlertMsg('이 대화는 멀티프로필 정보가 없어 진입할 수 없습니다.');
                  setAlertOpen(true);
                  return;
                }
                navigate(`/chat/${chat.characterId}?persona=${chat.personaId.toString()}`);
            }}
          >
            <img
                src={chat.profileImg || DEFAULT_PROFILE_IMAGE}
              alt={chat.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                onError={handleProfileImageError}
            />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{chat.name}</div>
                <div style={{ color: '#aaa', fontSize: '0.95rem', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{chat.lastMessage}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: 24, minWidth: 60 }}>
                <img
                  src={chat.personaAvatar || DEFAULT_PROFILE_IMAGE}
                  alt={chat.personaName || "프로필"}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginBottom: 2 }}
                  onError={handleProfileImageError}
                />
                <span style={{ fontSize: 12, color: '#bbb', maxWidth: 60, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.personaName || '유저프로필'}</span>
              </div>
              {editMode && !isGuestMode() && (
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
      {/* 게스트용 로그인 유도 모달 */}
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="채팅을 시작하려면 로그인이 필요합니다."
      />
      <CustomAlert open={alertOpen} title={alertTitle} message={alertMsg} onConfirm={() => setAlertOpen(false)} />
    </div>
  );
} 