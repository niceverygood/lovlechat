import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import MessageBubble from "../components/MessageBubble";
import OptimizedImage from "../components/OptimizedImage";
import ProfileDetailModal from "../components/ProfileDetailModal";
import FavorDetailModal from "../components/FavorDetailModal";
import FavorBubble from "../components/FavorBubble";
import CustomAlert from "../components/CustomAlert";
import Toast from "../components/Toast";
import ChatInput from "../components/ChatInput";
import LoginPromptModal from "../components/LoginPromptModal";
import { apiGet, apiPost } from '../lib/api';
import { ChatSkeleton } from "../components/Skeleton";
import { isGuestMode } from "../utils/guestMode";
import { DEFAULT_PROFILE_IMAGE } from "../utils/constants";
import { FAVOR_STAGES } from "../utils/favorUtils";
import './ChatPage.css';

interface Character {
  id: number;
  name: string;
  profileImg: string;
  age?: number;
  job?: string;
  info?: string;
  habit?: string;
  firstScene?: string;
  firstMessage?: string;
}

// 조사 자동 판별 함수: 받침 있으면 '과', 없으면 '와'
function getPostposition(name: string) {
  if (!name) return '와';
  const lastChar = name[name.length - 1];
  const code = lastChar.charCodeAt(0);
  // 한글 유니코드 범위 내에서 받침 여부 판별
  if (0xac00 <= code && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? '와' : '과';
  }
  // 한글이 아니면 기본 '와'
  return '와';
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const personaId = params.get("persona");
  const { user } = useAuth();
  const { hearts, loading: heartsLoading, error: heartsError, refreshHearts, useHearts: useHeartsFunction } = useHearts(user?.uid || null);
  const [persona, setPersona] = useState<{
    name: string;
    avatar: string;
    gender?: string;
    age?: string;
    job?: string;
    info?: string;
    habit?: string;
  }>({ name: "나", avatar: "/avatars/default-profile.png" });
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const { 
    messages, 
    loading, 
    error, 
    favor, 
    favorChange, 
    backgroundImageUrl,
    sendMessage, 
    reloadMessages 
  } = useChat(id ? parseInt(id) : undefined, personaId || undefined);
  const [character, setCharacter] = useState<Character | null>(null);
  const [characterLoading, setCharacterLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    id: string;
    name: string;
    avatar: string;
    gender?: string;
    age?: string;
    job?: string;
    info?: string;
    habit?: string;
  } | null>(null);
  const [showFavorModal, setShowFavorModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const favorRef = useRef(favor);
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

  // 단계별 정보 (아이콘과 설명 추가)
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
  
  const currentStageIdx = [...FAVOR_STAGES].reverse().findIndex(s => favor >= s.min);
  const stageIdx = currentStageIdx === -1 ? 0 : FAVOR_STAGES.length - 1 - currentStageIdx;
  const [selectedStageIdx, setSelectedStageIdx] = useState(stageIdx);
  useEffect(() => { setSelectedStageIdx(stageIdx); }, [stageIdx]);

  useEffect(() => {
    if (!id) return;
    setCharacterLoading(true);
    fetch(`/api/character/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setCharacter(data.character);
        setCharacterLoading(false);
      })
      .catch(() => setCharacterLoading(false));
  }, [id]);

  useEffect(() => {
    if (personaId) {
      // 게스트 모드에서 persona=guest인 경우 특별 처리
      if (isGuestMode() && personaId === 'guest') {
        setPersona({ name: "게스트", avatar: DEFAULT_PROFILE_IMAGE });
        setIsPersonaLoading(false);
        return;
      }
      
      setIsPersonaLoading(true);
      console.log('Fetching persona:', personaId);
      fetch(`/api/persona/${personaId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('Persona data:', data);
          if (data.ok) {
            const avatar = data.persona.avatar || DEFAULT_PROFILE_IMAGE;
            const personaData = {
              name: data.persona.name,
              avatar,
              gender: data.persona.gender,
              age: data.persona.age?.toString(),
              job: data.persona.job,
              info: data.persona.info,
              habit: data.persona.habit
            };
            console.log('Setting persona:', personaData);
            
            // 이미지 프리로딩
            const img = new Image();
            img.onload = () => {
              setPersona(personaData);
              setIsPersonaLoading(false);
            };
            img.onerror = () => {
              console.log('Failed to load persona image, using default');
              setPersona({ ...personaData, avatar: DEFAULT_PROFILE_IMAGE });
              setIsPersonaLoading(false);
            };
            img.src = avatar;
          }
        })
        .catch(error => {
          console.error('Error fetching persona:', error);
          setPersona({ name: "나", avatar: DEFAULT_PROFILE_IMAGE });
          setIsPersonaLoading(false);
        });
    } else {
      setIsPersonaLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (!id || !personaId) return;
    fetch(`/api/chat/first-date?personaId=${personaId}&characterId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.firstDate) {
          const start = new Date(data.firstDate);
          const now = new Date();
          const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          setDays(diff);
        }
      });
  }, [id, personaId]);

  useEffect(() => { favorRef.current = favor; }, [favor]);

  useEffect(() => {
    const handleFavorChange = (event: CustomEvent) => {
      const { change, current, previous } = event.detail;
      
      if (change && change !== 0 && !isGuestMode()) {
        // 호감도 말풍선 표시
        setFavorBubbleData({
          favorChange: change,
          currentFavor: current
        });
        setShowFavorBubble(true);
        
        // 기존 토스트 메시지도 유지 (선택사항)
        if (character && persona) {
          if (change > 0) {
            setToast({
              message: `축하합니다! ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${change}만큼 증가했습니다! (${current}점)`,
              type: "success"
            });
          } else if (change < 0) {
            setToast({
              message: `아쉬워요 ㅠ ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${Math.abs(change)}만큼 감소했습니다... (${current}점)`,
              type: "error"
            });
          }
        }
      }
    };

    window.addEventListener('favorChange', handleFavorChange as EventListener);
    
    return () => {
      window.removeEventListener('favorChange', handleFavorChange as EventListener);
    };
  }, [character, persona]);

  useEffect(() => {
    const timer = setTimeout(() => setShowNotice(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // 하트 에러 처리
  useEffect(() => {
    if (heartsError) {
      setToast({
        message: heartsError,
        type: "error"
      });
    }
  }, [heartsError]);

  // 게스트 모드에서 메시지 수 추적
  useEffect(() => {
    if (isGuestMode() && messages) {
      const userMessages = messages.filter(msg => msg.sender === 'user');
      setGuestMessageCount(userMessages.length);
    }
  }, [messages]);

  // 채팅방 진입 시 최초 한 번만 최하단 스크롤 (애니메이션 없음)
  const hasInitialScrolled = useRef(false);
  useEffect(() => {
    if (messages && messages.length > 0 && !hasInitialScrolled.current && messagesContainerRef.current) {
      // DOM 렌더링 완료 후 스크롤
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          hasInitialScrolled.current = true;
          console.log('🏠 채팅방 진입: 최근 메시지로 즉시 이동 완료');
        }
      }, 0);
    }
  }, [messages]);

  // 채팅 진행 중 새 메시지 추가 시 자동 스크롤
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (hasInitialScrolled.current && messages && messages.length > prevMessageCountRef.current && messagesContainerRef.current) {
      // 이미 초기 스크롤된 후, 새 메시지가 추가될 때만 부드러운 스크롤
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
          console.log('💬 새 메시지: 부드러운 스크롤 완료');
        }
      }, 100);
    }
    prevMessageCountRef.current = messages?.length || 0;
  }, [messages]);

  const handleProfileClick = useCallback((profile: {
    id: string;
    name: string;
    avatar: string;
    gender?: string;
    age?: string;
    job?: string;
    info?: string;
    habit?: string;
  }) => {
    setSelectedProfile(profile);
    setShowProfileModal(true);
  }, []);

  // 프로필 모달이 열릴 때 character가 있으면 항상 character를 선택
  useEffect(() => {
    if (showProfileModal) {
      if (selectedProfile && selectedProfile.id !== character?.id?.toString()) {
        // 이미 선택된 프로필이 캐릭터가 아니면 그대로 둔다(페르소나 등)
        return;
      }
      if (character) {
        setSelectedProfile({
          id: character.id.toString(),
          name: character.name,
          avatar: character.profileImg,
          age: character.age?.toString(),
          job: character.job,
          info: character.info,
          habit: character.habit
        });
      }
    }
  }, [showProfileModal, character, selectedProfile]);

  // 게스트 모드에서 메시지 전송 제한
  const handleSendMessage = useCallback(async (message: string) => {
    if (isGuestMode()) {
      console.log('게스트 모드 메시지 전송:', { guestMessageCount, message });
      
      if (guestMessageCount >= 3) {
        console.log('게스트 모드 메시지 제한 도달 - 로그인 모달 표시');
        setShowLoginModal(true);
        return;
      }
    }
    // 일반 메시지 전송 후 하트 잔액 갱신
    await sendMessage(message);
    await refreshHearts();
  }, [guestMessageCount, sendMessage, refreshHearts]);

  const handleLeaveChat = async () => {
    try {
      // 채팅방 DB 삭제
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
  };

  // 멀티프로필 이미지가 준비될 때까지 렌더링 보류
  if (isPersonaLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ff4081', fontWeight: 700 }}>멀티프로필 정보를 불러오는 중...</div>;
  }

  if (characterLoading || !character) {
    return <ChatSkeleton />;
  }

  // 디버깅: messages 상태 확인
  console.log('🏠 ChatPage 렌더링 상세:', { 
    timestamp: new Date().toISOString(),
    messages: messages, 
    messagesLength: messages?.length, 
    loading: loading,
    hasMessages: messages && messages.length > 0,
    condition: !messages || messages.length === 0,
    firstMessage: messages?.[0],
    messageTypes: messages?.map(m => typeof m),
    // 📍 useChat 파라미터 디버깅
    id: id,
    parsedId: id ? parseInt(id) : undefined,
    personaId: personaId,
    personaIdAfterOr: personaId || undefined,
    urlSearch: location.search,
    // 🔍 메시지 상세 정보
    messageDetails: messages?.map((msg, idx) => ({
      index: idx,
      id: msg.id,
      text: msg.text?.substring(0, 20) + '...',
      sender: msg.sender
    }))
  });

  if (!messages || messages.length === 0) {
    // 채팅 내역이 없을 때: 상단 캐릭터 정보/첫 장면/첫 대사만 보여주고, 메시지 영역은 비워둠
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
        {/* 헤더 */}
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
            <button onClick={() => navigate('/home')} style={{ background: "none", border: "none", fontSize: 24, marginRight: 12, cursor: "pointer", color: "#fff" }}>&larr;</button>
            <img
              src={character.profileImg}
              alt={character.name}
              style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12, cursor: "pointer" }}
              onClick={() => handleProfileClick({
                id: character.id.toString(),
                name: character.name,
                avatar: character.profileImg,
                age: character.age?.toString(),
                job: character.job,
                info: character.info,
                habit: character.habit
              })}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{character.name}</div>
              <div style={{ color: "#888", fontSize: 14 }}>{character.age ? `${character.age}살` : "나이 비공개"} · {character.job || "직업 비공개"}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* 하트 표시 */}
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
                {heartsLoading ? "..." : hearts}
              </span>
            </div>
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setShowMoreModal(true)}>⋮</span>
          </div>
        </div>
              {/* 관계 단계(스텝바) 상단 좌측에 작게 표시 + 우측에 호감도 (게스트 모드에서는 메시지 카운터) */}
      <div style={{ background: "var(--color-card)", display: "flex", alignItems: "center", borderBottom: "1.5px solid var(--color-point)", padding: "0 0 0 0", position: "sticky", top: 56, zIndex: 9, minHeight: 36, justifyContent: 'space-between' }}>
        {isGuestMode() ? (
          // 게스트 모드: 메시지 카운터 표시
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
              <span style={{ fontSize: 16 }}>💬</span>
              <span style={{ fontWeight: 700, color: '#ff4081', fontSize: 16 }}>게스트 체험</span>
            </div>
            <div style={{ marginRight: 16, color: '#ff4081', fontWeight: 700, fontSize: 15, padding: '4px 12px', borderRadius: 8, background: 'rgba(255, 64, 129, 0.1)', border: '1px solid rgba(255, 64, 129, 0.3)' }}>
              메시지: <span style={{ color: guestMessageCount >= 3 ? '#ff6b6b' : '#ff4081', fontWeight: 700 }}>{guestMessageCount}/3</span>
            </div>
          </>
        ) : (
          // 일반 모드: 기존 관계 단계
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
              {FAVOR_STAGES.map((s, idx) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', opacity: idx === stageIdx ? 1 : 0.4, margin: '0 2px' }}>
                  <span style={{ fontSize: 16, marginRight: 2 }}>{STAGE_ICONS[s.label as keyof typeof STAGE_ICONS]}</span>
                  <span style={{ fontWeight: idx === stageIdx ? 700 : 500, color: idx === stageIdx ? '#ff4081' : '#bbb', fontSize: 14 }}>{s.label}</span>
                  {idx < FAVOR_STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
                </div>
              ))}
            </div>
            <button
              style={{ marginRight: 16, background: 'none', border: 'none', color: '#ff4081', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '4px 12px', borderRadius: 8, transition: 'background 0.2s' }}
              onClick={() => setShowFavorModal(true)}
            >
              호감도: <span style={{ color: '#ff4081', fontWeight: 700 }}>{favor}점</span>
            </button>
          </>
        )}
      </div>
        {/* 스토리/메시지 영역 */}
        <div 
          ref={messagesContainerRef}
          className="messages-container" 
          style={{ 
            flex: 1, 
            overflowY: "auto",
            padding: "0 0 16px 0",
            display: "flex",
            flexDirection: "column",
            scrollBehavior: "auto"
          }}
        >
          {/* 첫 장면/첫대사 표시 */}
          {character?.firstScene && (
            <div style={{ color: "#b97cae", fontSize: 16, textAlign: "center", margin: "32px 0 8px 0", whiteSpace: "pre-line" }}>
              <b>첫 장면</b><br />{character.firstScene}
            </div>
          )}
          {character?.firstMessage && (
            <div style={{ color: "#ff4081", fontSize: 16, textAlign: "center", margin: "8px 0 16px 0", whiteSpace: "pre-line" }}>
              <b>첫 대사</b><br />{character.firstMessage}
            </div>
          )}
          {/* 메시지 리스트 */}
          {messages.map((msg, idx) => {
            console.log(`💬 메시지 ${idx + 1} 렌더링:`, msg);
            return (
              <div key={idx} style={{ padding: "0 16px", marginBottom: 8 }}>
                <MessageBubble
                message={{
                  sender: msg.sender,
                  text: msg.message,
                  avatar: (msg.sender as any) === "ai" || (msg.sender as any) === "assistant" || msg.sender === "character"
                    ? msg.characterProfileImg || character.profileImg || DEFAULT_PROFILE_IMAGE
                    : persona.avatar || DEFAULT_PROFILE_IMAGE,
                  characterName: msg.characterName,
                  characterProfileImg: msg.characterProfileImg,
                  characterAge: msg.characterAge,
                  characterJob: msg.characterJob
                }}
                onProfileClick={() => {
                  if ((msg.sender as any) === "ai" || (msg.sender as any) === "assistant" || msg.sender === "character") {
                    handleProfileClick({
                      id: character.id.toString(),
                      name: msg.characterName || character.name,
                      avatar: msg.characterProfileImg || character.profileImg,
                      age: (msg.characterAge || character.age)?.toString(),
                      job: msg.characterJob || character.job,
                      info: character.info,
                      habit: character.habit
                    });
                  } else if (msg.sender === "user") {
                    handleProfileClick({
                      id: personaId ?? "",
                      name: persona.name,
                      avatar: persona.avatar ?? "",
                      gender: persona.gender,
                      age: persona.age,
                      job: persona.job,
                      info: persona.info,
                      habit: persona.habit
                    });
                  }
                }}
              />
            </div>
            );
          })}
          {/* ChatGPT 스타일 로딩 인디케이터 */}
          {loading && (
            <div style={{ padding: '0 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* 캐릭터 프로필 이미지 */}
              <img
                src={character.profileImg || DEFAULT_PROFILE_IMAGE}
                alt={character.name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: 4
                }}
              />
              {/* 로딩 말풍선 */}
              <div style={{
                background: 'var(--color-card)',
                color: '#999',
                borderRadius: 18,
                padding: '12px 16px',
                fontSize: 14,
                display: 'inline-block',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid var(--color-border)',
                position: 'relative'
              }}>
                <span className="chat-loading-dots">●●●</span>
              </div>
              <style>{`
                .chat-loading-dots {
                  display: inline-block;
                  font-size: 14px;
                  letter-spacing: 2px;
                  color: #ff4081;
                  animation: chat-dots-blink 1.4s infinite;
                }
                @keyframes chat-dots-blink {
                  0%, 80%, 100% { 
                    opacity: 0.3; 
                  }
                  40% { 
                    opacity: 1; 
                  }
                }
                .chat-loading-dots:nth-child(1) {
                  animation-delay: 0s;
                }
                .chat-loading-dots:nth-child(2) {
                  animation-delay: 0.2s;
                }
                .chat-loading-dots:nth-child(3) {
                  animation-delay: 0.4s;
                }
              `}</style>
            </div>
          )}
          {/* 호감도 변화 말풍선 */}
          {showFavorBubble && favorBubbleData && (
            <FavorBubble
              favorChange={favorBubbleData.favorChange}
              currentFavor={favorBubbleData.currentFavor}
              onAnimationEnd={() => {
                setShowFavorBubble(false);
                setFavorBubbleData(null);
              }}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* 입력 영역 */}
        <ChatInput
          onSendMessage={handleSendMessage}
          loading={loading}
        />
        
        {/* 게스트 모드 로그인 모달 */}
        {showLoginModal && (
          <LoginPromptModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            message="더 많은 대화를 나누려면 로그인이 필요해요!"
          />
        )}
      </div>
    );
  }

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
      {/* 헤더 */}
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
          <button onClick={() => navigate('/home')} style={{ background: "none", border: "none", fontSize: 24, marginRight: 12, cursor: "pointer", color: "#fff" }}>&larr;</button>
          <img
            src={character.profileImg || DEFAULT_PROFILE_IMAGE}
            alt={character.name}
            style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12, cursor: "pointer" }}
            onClick={() => handleProfileClick({
              id: character.id.toString(),
              name: character.name,
              avatar: character.profileImg || DEFAULT_PROFILE_IMAGE,
              age: character.age?.toString(),
              job: character.job,
              info: character.info,
              habit: character.habit
            })}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{character.name}</div>
            <div style={{ color: "#888", fontSize: 14 }}>{character.age ? `${character.age}살` : "나이 비공개"} · {character.job || "직업 비공개"}</div>
          </div>
        </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* 하트 표시 */}
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
                {heartsLoading ? "..." : hearts}
              </span>
            </div>
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setShowMoreModal(true)}>⋮</span>
          </div>
        </div>
              {/* 관계 단계(스텝바) 상단 좌측에 작게 표시 + 우측에 호감도 (게스트 모드에서는 메시지 카운터) */}
        <div style={{ background: "var(--color-card)", display: "flex", alignItems: "center", borderBottom: "1.5px solid var(--color-point)", padding: "0 0 0 0", position: "sticky", top: 56, zIndex: 9, minHeight: 36, justifyContent: 'space-between' }}>
          {isGuestMode() ? (
            // 게스트 모드: 메시지 카운터 표시
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                <span style={{ fontSize: 16 }}>💬</span>
                <span style={{ fontWeight: 700, color: '#ff4081', fontSize: 16 }}>게스트 체험</span>
              </div>
              <div style={{ marginRight: 16, color: '#ff4081', fontWeight: 700, fontSize: 15, padding: '4px 12px', borderRadius: 8, background: 'rgba(255, 64, 129, 0.1)', border: '1px solid rgba(255, 64, 129, 0.3)' }}>
                메시지: <span style={{ color: guestMessageCount >= 3 ? '#ff6b6b' : '#ff4081', fontWeight: 700 }}>{guestMessageCount}/3</span>
              </div>
            </>
          ) : (
            // 일반 모드: 기존 관계 단계
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
                {FAVOR_STAGES.map((s, idx) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', opacity: idx === stageIdx ? 1 : 0.4, margin: '0 2px' }}>
                    <span style={{ fontSize: 16, marginRight: 2 }}>{STAGE_ICONS[s.label as keyof typeof STAGE_ICONS]}</span>
                    <span style={{ fontWeight: idx === stageIdx ? 700 : 500, color: idx === stageIdx ? '#ff4081' : '#bbb', fontSize: 14 }}>{s.label}</span>
                    {idx < FAVOR_STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
                  </div>
                ))}
              </div>
              <button
                style={{ marginRight: 16, background: 'none', border: 'none', color: '#ff4081', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '4px 12px', borderRadius: 8, transition: 'background 0.2s' }}
                onClick={() => setShowFavorModal(true)}
              >
                호감도: <span style={{ color: '#ff4081', fontWeight: 700 }}>{favor}점</span>
              </button>
            </>
          )}
        </div>
      {/* 스토리/메시지 영역 */}
      <div 
        ref={messagesContainerRef}
        className="messages-container" 
        style={{ 
          flex: 1, 
          overflowY: "auto",
          padding: "0 0 16px 0",
          display: "flex",
          flexDirection: "column",
          scrollBehavior: "auto"
        }}
      >
        {/* 첫 장면/첫대사 표시 */}
        {character?.firstScene && (
          <div style={{ color: "#b97cae", fontSize: 16, textAlign: "center", margin: "32px 0 8px 0", whiteSpace: "pre-line" }}>
            <b>첫 장면</b><br />{character.firstScene}
          </div>
        )}
        {character?.firstMessage && (
          <div style={{ color: "#ff4081", fontSize: 16, textAlign: "center", margin: "8px 0 16px 0", whiteSpace: "pre-line" }}>
            <b>첫 대사</b><br />{character.firstMessage}
          </div>
        )}
        {/* 메시지 리스트 */}
        {messages.map((msg, idx) => {
          console.log(`💬 메시지 ${idx + 1} 렌더링:`, msg);
          return (
            <div key={idx} style={{ padding: "0 16px", marginBottom: 8 }}>
              <MessageBubble
              message={{
                sender: msg.sender,
                text: msg.message,
                avatar: (msg.sender as any) === "ai" || (msg.sender as any) === "assistant" || msg.sender === "character"
                  ? msg.characterProfileImg || character.profileImg || DEFAULT_PROFILE_IMAGE
                  : persona.avatar || DEFAULT_PROFILE_IMAGE,
                characterName: msg.characterName,
                characterProfileImg: msg.characterProfileImg,
                characterAge: msg.characterAge,
                characterJob: msg.characterJob
              }}
              onProfileClick={() => {
                if ((msg.sender as any) === "ai" || (msg.sender as any) === "assistant" || msg.sender === "character") {
                  handleProfileClick({
                    id: character.id.toString(),
                    name: msg.characterName || character.name,
                    avatar: msg.characterProfileImg || character.profileImg,
                    age: (msg.characterAge || character.age)?.toString(),
                    job: msg.characterJob || character.job,
                    info: character.info,
                    habit: character.habit
                  });
                } else if (msg.sender === "user") {
                  handleProfileClick({
                    id: personaId ?? "",
                    name: persona.name,
                    avatar: persona.avatar ?? "",
                    gender: persona.gender,
                    age: persona.age,
                    job: persona.job,
                    info: persona.info,
                    habit: persona.habit
                  });
                }
              }}
            />
          </div>
          );
        })}
        {/* ChatGPT 스타일 로딩 인디케이터 */}
        {loading && (
          <div style={{ padding: '0 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* 캐릭터 프로필 이미지 */}
            <img
              src={character.profileImg || DEFAULT_PROFILE_IMAGE}
              alt={character.name}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                flexShrink: 0,
                marginTop: 4
              }}
            />
            {/* 로딩 말풍선 */}
            <div style={{
              background: 'var(--color-card)',
              color: '#999',
              borderRadius: 18,
              padding: '12px 16px',
              fontSize: 14,
              display: 'inline-block',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid var(--color-border)',
              position: 'relative'
            }}>
              <span className="chat-loading-dots">●●●</span>
            </div>
            <style>{`
              .chat-loading-dots {
                display: inline-block;
                font-size: 14px;
                letter-spacing: 2px;
                color: #ff4081;
                animation: chat-dots-blink 1.4s infinite;
              }
              @keyframes chat-dots-blink {
                0%, 80%, 100% { 
                  opacity: 0.3; 
                }
                40% { 
                  opacity: 1; 
                }
              }
              .chat-loading-dots:nth-child(1) {
                animation-delay: 0s;
              }
              .chat-loading-dots:nth-child(2) {
                animation-delay: 0.2s;
              }
              .chat-loading-dots:nth-child(3) {
                animation-delay: 0.4s;
              }
            `}</style>
          </div>
        )}
        {/* 호감도 변화 말풍선 */}
        {showFavorBubble && favorBubbleData && (
          <FavorBubble
            favorChange={favorBubbleData.favorChange}
            currentFavor={favorBubbleData.currentFavor}
            onAnimationEnd={() => {
              setShowFavorBubble(false);
              setFavorBubbleData(null);
            }}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* 입력 영역 */}
      <ChatInput
        onSendMessage={handleSendMessage}
        loading={loading}
      />
      
      {/* 게스트 모드 로그인 모달 */}
      {showLoginModal && (
        <LoginPromptModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          message="더 많은 대화를 나누려면 로그인이 필요해요!"
        />
      )}

      {/* 프로필 상세 모달 */}
      <ProfileDetailModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={selectedProfile || {
          id: "",
          name: "",
          avatar: ""
        }}
      />

      {/* 호감도 상세 모달 */}
      <FavorDetailModal
        isOpen={showFavorModal}
        onClose={() => setShowFavorModal(false)}
        character={{ name: character.name, avatar: character.profileImg }}
        user={{ name: persona.name, avatar: persona.avatar }}
        favor={favor}
        days={days}
      />

      {/* 쩜 세개(⋮) 모달 */}
      {showMoreModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3001,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowMoreModal(false)}>
          <div style={{ background: '#fff', borderRadius: 18, minWidth: 260, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>
            <button style={{ width: '100%', background: '#ff4081', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 17, cursor: 'pointer' }} onClick={() => { setShowMoreModal(false); setShowReportModal(true); }}>캐릭터 신고하기</button>
            <button style={{ width: '100%', background: '#eee', color: '#ff4081', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 17, cursor: 'pointer' }} onClick={() => { setShowMoreModal(false); setShowLeaveConfirm(true); }}>채팅 나가기</button>
          </div>
        </div>
      )}

      {/* 채팅 나가기 확인 CustomAlert */}
      <CustomAlert
        open={showLeaveConfirm}
        title="채팅방 나가기"
        message="채팅을 나가면 내용이 영구적으로 삭제 됩니다.\n정말 나가시겠습니까?"
        onConfirm={handleLeaveChat}
        onCancel={() => setShowLeaveConfirm(false)}
        confirmText="나가기"
        cancelText="취소"
      />

      {/* 신고하기 모달 */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3002,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowReportModal(false)}>
          <div style={{ background: '#fff', borderRadius: 18, minWidth: 320, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: '#ff4081', fontWeight: 700, fontSize: 18, textAlign: 'center', marginBottom: 8 }}>신고 사유를 적어주세요</div>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="신고 사유를 입력하세요"
              style={{ width: '100%', minHeight: 80, borderRadius: 10, border: '1.5px solid #ff4081', padding: 12, fontSize: 16, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
              <button style={{ flex: 1, background: '#eee', color: '#ff4081', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }} onClick={() => setShowReportModal(false)}>취소</button>
              <a
                href={`mailto:lovlechat.official@gmail.com?subject=캐릭터 신고&body=${encodeURIComponent(reportReason)}`}
                style={{ flex: 1, background: '#ff4081', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'inline-block' }}
                onClick={() => { setShowReportModal(false); setReportReason(""); }}
              >확인</a>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

