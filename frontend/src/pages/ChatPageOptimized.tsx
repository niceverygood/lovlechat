import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useChatRoom } from "../hooks/useChatRoom";
import { useAuth } from "../hooks/useAuth";
import MessageBubble from "../components/MessageBubble";
import ProfileDetailModal from "../components/ProfileDetailModal";
import FavorDetailModal from "../components/FavorDetailModal";
import FavorBubble from "../components/FavorBubble";
import CustomAlert from "../components/CustomAlert";
import Toast from "../components/Toast";
import ChatInput from "../components/ChatInput";
import LoginPromptModal from "../components/LoginPromptModal";
import { ChatSkeleton } from "../components/Skeleton";
import { isGuestMode } from "../utils/guestMode";
import { DEFAULT_PROFILE_IMAGE } from "../utils/constants";
import { FAVOR_STAGES } from "../utils/favorUtils";
import OptimizedImage from "../components/OptimizedImage";
import './ChatPage.css';

// 조사 자동 판별 함수
function getPostposition(name: string) {
  if (!name) return '와';
  const lastChar = name[name.length - 1];
  const code = lastChar.charCodeAt(0);
  if (0xac00 <= code && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? '와' : '과';
  }
  return '와';
}

// 메모이제이션된 HeartDisplay 컴포넌트
const HeartDisplay = React.memo<{ hearts: number; loading?: boolean }>(({ hearts, loading }) => (
  <div style={{ 
    display: "flex", 
    alignItems: "center", 
    gap: 4, 
    background: "rgba(255, 64, 129, 0.1)", 
    padding: "4px 8px", 
    borderRadius: 12,
    border: "1px solid rgba(255, 64, 129, 0.3)"
  }}>
    <span style={{ fontSize: 16 }}>💖</span>
    <span style={{ 
      fontSize: 14, 
      fontWeight: 700, 
      color: "#ff4081",
      minWidth: "20px" 
    }}>
      {loading ? "..." : hearts}
    </span>
  </div>
));

// 메모이제이션된 CharacterHeader 컴포넌트
const CharacterHeader = React.memo<{
  character: any;
  hearts: number;
  loading?: boolean;
  onProfileClick: () => void;
  onMoreClick: () => void;
  onBackClick: () => void;
}>(({ character, hearts, loading, onProfileClick, onMoreClick, onBackClick }) => (
  <div style={{ 
    background: "var(--color-card)", 
    padding: "12px 20px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between", 
    borderBottom: "1px solid var(--color-border)", 
    position: "sticky", 
    top: 0, 
    zIndex: 10 
  }}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <button 
        onClick={onBackClick} 
        style={{ background: "none", border: "none", fontSize: 24, marginRight: 12, cursor: "pointer", color: "#fff" }}
      >
        &larr;
      </button>
      <OptimizedImage
        src={character.profileImg}
        alt={character.name}
        style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12, cursor: "pointer" }}
        onClick={onProfileClick}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{character.name}</div>
        <div style={{ color: "#888", fontSize: 14 }}>
          {character.age ? `${character.age}살` : "나이 비공개"} · {character.job || "직업 비공개"}
        </div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <HeartDisplay hearts={hearts} loading={loading} />
      <span style={{ fontSize: 20, cursor: "pointer" }} onClick={onMoreClick}>⋮</span>
    </div>
  </div>
));

export default function ChatPageOptimized() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const personaId = params.get("persona");
  const { user } = useAuth();

  // 통합 훅 사용
  const {
    character,
    persona,
    messages,
    days,
    favor,
    hearts,
    backgroundImageUrl,
    loading,
    error,
    cached,
    responseTime,
    sendMessage: sendChatMessage,
    refreshChatRoom,
    clearCache,
    loadMoreMessages
  } = useChatRoom(id, personaId || undefined);

  // UI 상태
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showFavorModal, setShowFavorModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showNotice, setShowNotice] = useState(true);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestMessageCount, setGuestMessageCount] = useState(0);

  // 호감도 말풍선 상태
  const [showFavorBubble, setShowFavorBubble] = useState(false);
  const [favorBubbleData, setFavorBubbleData] = useState<{
    favorChange: number;
    currentFavor: number;
  } | null>(null);

  // 스크롤 관리
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolled = useRef(false);
  const prevMessageCountRef = useRef(0);

  // 호감도 단계 계산
  const currentStageIdx = [...FAVOR_STAGES].reverse().findIndex(s => favor >= s.min);
  const stageIdx = currentStageIdx === -1 ? 0 : FAVOR_STAGES.length - 1 - currentStageIdx;
  const [selectedStageIdx, setSelectedStageIdx] = useState(stageIdx);

  // 단계별 정보
  const STAGE_ICONS = {
    '아는사이': '🤝',
    '친구': '😊',
    '썸': '💓',
    '연인': '💑',
    '결혼': '💍'
  };

  const STAGE_DESCRIPTIONS = {
    '아는사이': '새로운 인연을 맺을 준비가 되었나요?',
    '친구': '서로 웃고 떠들며 일상을 공유해요',
    '썸': '감정이 싹트며 설렘을 느껴요',
    '연인': '같이 시간을 보내며 둘만의 러브스토리를 만들어가요',
    '결혼': '오랜 신뢰와 헌신으로 단단하게 쌓아온 깊은 사랑을 축하해요'
  };

  // 이벤트 핸들러들 (useCallback으로 최적화)
  const handleProfileClick = useCallback((profile: any) => {
    setSelectedProfile(profile);
    setShowProfileModal(true);
  }, []);

  const handleBackClick = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  const handleMoreClick = useCallback(() => {
    setShowMoreModal(true);
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    if (isGuestMode()) {
      if (guestMessageCount >= 3) {
        setShowLoginModal(true);
        return;
      }
    }
    await sendChatMessage(message);
  }, [sendChatMessage, guestMessageCount]);

  const handleLeaveChat = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, characterId: id })
      });

      if (!response.ok) {
        throw new Error('채팅방 나가기에 실패했습니다.');
      }

      const data = await response.json();
      if (data.ok) {
        navigate('/home');
      } else {
        throw new Error(data.error || '채팅방 나가기에 실패했습니다.');
      }
    } catch (error) {
      console.error('채팅방 나가기 오류:', error);
      setToast({
        message: '채팅방 나가기에 실패했습니다. 다시 시도해주세요.',
        type: 'error'
      });
    }
  }, [personaId, id, navigate]);

  // 호감도 변화 이벤트 리스너
  useEffect(() => {
    const handleFavorChange = (event: CustomEvent) => {
      const { change, current } = event.detail;
      
      if (change && change !== 0 && !isGuestMode()) {
        setFavorBubbleData({ favorChange: change, currentFavor: current });
        setShowFavorBubble(true);
        
        if (character && persona) {
          const message = change > 0 
            ? `축하합니다! ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${change}만큼 증가했습니다! (${current}점)`
            : `아쉬워요 ㅠ ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${Math.abs(change)}만큼 감소했습니다... (${current}점)`;
          
          setToast({ message, type: change > 0 ? "success" : "error" });
        }
      }
    };

    window.addEventListener('favorChange', handleFavorChange as EventListener);
    return () => window.removeEventListener('favorChange', handleFavorChange as EventListener);
  }, [character, persona]);

  // 게스트 모드 메시지 수 추적
  useEffect(() => {
    if (isGuestMode() && messages) {
      const userMessages = messages.filter(msg => msg.sender === 'user');
      setGuestMessageCount(userMessages.length);
    }
  }, [messages]);

  // 스크롤 관리
  useEffect(() => {
    if (messages && messages.length > 0 && !hasInitialScrolled.current && messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          hasInitialScrolled.current = true;
        }
      }, 0);
    }
  }, [messages]);

  useEffect(() => {
    if (hasInitialScrolled.current && messages && messages.length > prevMessageCountRef.current && messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
    prevMessageCountRef.current = messages?.length || 0;
  }, [messages]);

  // 기타 초기화
  useEffect(() => {
    setSelectedStageIdx(stageIdx);
  }, [stageIdx]);

  useEffect(() => {
    const timer = setTimeout(() => setShowNotice(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error) {
      setToast({ message: error, type: "error" });
    }
  }, [error]);

  // 로딩 상태
  if (loading && !character) {
    return <ChatSkeleton />;
  }

  if (!character) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ff4081', fontWeight: 700 }}>
        캐릭터 정보를 불러올 수 없습니다.
      </div>
    );
  }

  // 캐시 정보 표시 (개발 모드에서만)
  const showCacheInfo = process.env.NODE_ENV === 'development' && cached !== undefined;

  return (
    <div className="chat-container" style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh", 
      background: backgroundImageUrl 
        ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${backgroundImageUrl})` 
        : "var(--color-bg)",
      backgroundSize: backgroundImageUrl ? "cover" : "auto",
      backgroundPosition: backgroundImageUrl ? "center" : "initial",
      backgroundRepeat: "no-repeat",
      transition: "background 1s ease-in-out"
    }}>
      {/* 캐시 정보 (개발 모드) */}
      {showCacheInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          background: cached ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)',
          color: 'black',
          padding: '4px 8px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          {cached ? '✅ 캐시' : '🔄 신규'} {responseTime}ms
        </div>
      )}

      {/* 헤더 */}
      <CharacterHeader
        character={character}
        hearts={hearts}
        loading={loading}
        onProfileClick={() => handleProfileClick({
          id: character.id.toString(),
          name: character.name,
          avatar: character.profileImg,
          age: character.age?.toString(),
          job: character.job,
          info: character.info,
          habit: character.habit
        })}
        onMoreClick={handleMoreClick}
        onBackClick={handleBackClick}
      />

      {/* 관계 단계 바 */}
      <div style={{ 
        background: "var(--color-card)", 
        display: "flex", 
        alignItems: "center", 
        borderBottom: "1.5px solid var(--color-point)", 
        padding: "0 0 0 0", 
        position: "sticky", 
        top: 56, 
        zIndex: 9, 
        minHeight: 36, 
        justifyContent: 'space-between' 
      }}>
        {isGuestMode() ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
              <span style={{ fontSize: 16 }}>💬</span>
              <span style={{ fontWeight: 700, color: '#ff4081', fontSize: 16 }}>게스트 체험</span>
            </div>
            <div style={{ marginRight: 16, fontSize: 14, color: '#888' }}>
              {guestMessageCount}/3 메시지
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                             <span style={{ fontSize: 14 }}>{STAGE_ICONS[FAVOR_STAGES[selectedStageIdx]?.label as keyof typeof STAGE_ICONS]}</span>
               <span style={{ fontWeight: 700, color: '#ff4081', fontSize: 14 }}>{FAVOR_STAGES[selectedStageIdx]?.label}</span>
            </div>
            <div style={{ marginRight: 16, fontSize: 14, color: '#888' }}>
              {favor}점 {days > 1 && `• ${days}일째`}
            </div>
          </>
        )}
      </div>

      {/* 메시지 영역 */}
      <div 
        className="messages-container"
        ref={messagesContainerRef}
        style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* 더 불러오기 버튼 */}
        {messages.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <button
              onClick={loadMoreMessages}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? '로딩 중...' : '이전 메시지 더보기'}
            </button>
          </div>
        )}

        {/* 메시지 목록 */}
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.id}-${index}`}
            message={message}
            onProfileClick={message.sender === 'user' && persona 
              ? () => handleProfileClick({
                  id: persona.id,
                  name: persona.name,
                  avatar: persona.avatar,
                  gender: persona.gender,
                  age: persona.age?.toString(),
                  job: persona.job,
                  info: persona.info,
                  habit: persona.habit
                })
              : message.sender !== 'user' && character
              ? () => handleProfileClick({
                  id: character.id.toString(),
                  name: character.name,
                  avatar: character.profileImg,
                  age: character.age?.toString(),
                  job: character.job,
                  info: character.info,
                  habit: character.habit
                })
              : undefined
            }
          />
        ))}

        {loading && messages.length > 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>
            메시지 전송 중...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 채팅 입력 */}
      <ChatInput onSendMessage={handleSendMessage} disabled={loading} loading={loading} />

      {/* 호감도 말풍선 */}
      {showFavorBubble && favorBubbleData && (
        <FavorBubble
          favorChange={favorBubbleData.favorChange}
          currentFavor={favorBubbleData.currentFavor}
          onAnimationEnd={() => setShowFavorBubble(false)}
        />
      )}

      {/* 모달들 */}
      {showProfileModal && selectedProfile && (
        <ProfileDetailModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          profile={selectedProfile}
        />
      )}

      {/* FavorDetailModal 임시 제거 - 컴포넌트 인터페이스 확인 필요 */}

      {showLoginModal && (
        <LoginPromptModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* 더보기 모달 */}
      {showMoreModal && (
        <CustomAlert
          open={showMoreModal}
          onClose={() => setShowMoreModal(false)}
          title="채팅방 설정"
          children={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  setShowMoreModal(false);
                  setShowFavorModal(true);
                }}
                style={{
                  background: '#ff4081',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                💕 호감도 보기
              </button>
              <button
                onClick={() => {
                  setShowMoreModal(false);
                  refreshChatRoom();
                }}
                style={{
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                🔄 새로고침
              </button>
              <button
                onClick={() => {
                  setShowMoreModal(false);
                  setShowLeaveConfirm(true);
                }}
                style={{
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                🚪 채팅방 나가기
              </button>
            </div>
          }
        />
      )}

      {/* 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <CustomAlert
          open={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          title="채팅방 나가기"
          message={`정말로 ${character.name}과의 채팅방을 나가시겠습니까?\n모든 대화 내역이 삭제됩니다.`}
          confirmText="나가기"
          cancelText="취소"
          onConfirm={handleLeaveChat}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
} 