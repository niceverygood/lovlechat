import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import MessageBubble from "../components/MessageBubble";
import ProfileDetailModal from "../components/ProfileDetailModal";
import FavorDetailModal from "../components/FavorDetailModal";
import Toast from "../components/Toast";

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
  const { messages, sendMessage, loading, favor } = useChat(id ?? "", personaId || "");
  const [input, setInput] = useState("");
  const [character, setCharacter] = useState<Character | null>(null);
  const [persona, setPersona] = useState<{ name: string; avatar: string }>({ name: "나", avatar: "/avatars/default-profile.png" });
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const favorRef = useRef(favor);
  const [showNotice, setShowNotice] = useState(true);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  // 단계별 정보
  const STAGES = [
    { label: "아는사이", min: 0, desc: "새로운 인연을 맺을 준비가 되었나요?", icon: "🤝" },
    { label: "친구", min: 20, desc: "서로 웃고 떠들며 일상을 공유해요", icon: "😊" },
    { label: "썸", min: 50, desc: "감정이 싹트며 설렘을 느껴요", icon: "💓" },
    { label: "연인", min: 400, desc: "같이 시간을 보내며 둘만의 러브스토리를 만들어가요", icon: "💑" },
    { label: "결혼", min: 4000, desc: "오랜 신뢰와 헌신으로 단단하게 쌓아온 깊은 사랑을 축하해요", icon: "💍" },
  ];
  const currentStageIdx = [...STAGES].reverse().findIndex(s => favor >= s.min);
  const stageIdx = currentStageIdx === -1 ? 0 : STAGES.length - 1 - currentStageIdx;
  const [selectedStageIdx, setSelectedStageIdx] = useState(stageIdx);
  useEffect(() => { setSelectedStageIdx(stageIdx); }, [stageIdx]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/character/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setCharacter(data.character);
      });
  }, [id]);

  // 메시지 영역 스크롤: 최초 진입시에는 바로, 이후에는 부드럽게
  const isFirstScroll = useRef(true);
  useEffect(() => {
    if (messagesEndRef.current) {
      if (isFirstScroll.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        isFirstScroll.current = false;
      } else {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  useEffect(() => {
    if (personaId) {
      fetch(`/api/persona/${personaId}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) setPersona({ name: data.persona.name, avatar: data.persona.avatar });
        });
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
    if (!character || !persona) return;
    if (favorRef.current === undefined) return;
    const diff = favor - favorRef.current;
    if (diff === 0) return;
    if (diff > 0) {
      setToast({
        message: `축하합니다! ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${diff}만큼 증가 했습니다!`,
        type: "success"
      });
    } else if (diff < 0) {
      setToast({
        message: `아쉬워요 ㅠ ${character.name}${getPostposition(character.name)} ${persona.name}님의 호감도가 ${-diff}만큼 감소 했습니다 :(`,
        type: "error"
      });
    }
  }, [favor]);

  useEffect(() => {
    const timer = setTimeout(() => setShowNotice(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const handleProfileClick = (profile: {
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
  };

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

  if (!personaId) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ff4081', fontWeight: 700 }}>멀티프로필을 먼저 선택해주세요.</div>;
  }

  if (!character) return <div>로딩 중...</div>;

  if (!messages || messages.length === 0) {
    // 채팅 내역이 없을 때: 상단 캐릭터 정보/첫 장면/첫 대사만 보여주고, 메시지 영역은 비워둠
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg)" }}>
        {/* 헤더 */}
        <div style={{ background: "var(--color-card)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 10 }}>
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
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setShowMoreModal(true)}>⋮</span>
          </div>
        </div>
        {/* 관계 단계(스텝바) 상단 좌측에 작게 표시 + 우측에 호감도 */}
        <div style={{ background: "var(--color-card)", display: "flex", alignItems: "center", borderBottom: "1.5px solid var(--color-point)", padding: "0 0 0 0", position: "sticky", top: 56, zIndex: 9, minHeight: 36, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
            {STAGES.map((s, idx) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', opacity: idx === stageIdx ? 1 : 0.4, margin: '0 2px' }}>
                <span style={{ fontSize: 16, marginRight: 2 }}>{s.icon}</span>
                <span style={{ fontWeight: idx === stageIdx ? 700 : 500, color: idx === stageIdx ? '#ff4081' : '#bbb', fontSize: 14 }}>{s.label}</span>
                {idx < STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
              </div>
            ))}
          </div>
          <button
            style={{ marginRight: 16, background: 'none', border: 'none', color: '#ff4081', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '4px 12px', borderRadius: 8, transition: 'background 0.2s' }}
            onClick={() => setShowFavorModal(true)}
          >
            호감도: <span style={{ color: '#ff4081', fontWeight: 700 }}>{favor}점</span>
          </button>
        </div>
        {/* 스토리/메시지 영역 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 16px 0", display: "flex", flexDirection: "column" }}>
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
        </div>
        {/* 입력 영역 */}
        <form onSubmit={handleSubmit} style={{ background: "var(--color-card)", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 24,
                border: "1px solid #eee",
                fontSize: 16,
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "#f5f5f5" : "#ff4081",
                color: loading || !input.trim() ? "#bbb" : "#fff",
                border: "none",
                borderRadius: 24,
                padding: "0 24px",
                fontWeight: 700,
                fontSize: 16,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer"
              }}
            >
              전송
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg)" }}>
      {/* 헤더 */}
      <div style={{ background: "var(--color-card)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 10 }}>
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
        <div style={{ display: "flex", gap: 16 }}>
          {/* <span style={{ fontSize: 20, cursor: "pointer" }}>🔍</span> */}
          <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setShowMoreModal(true)}>⋮</span>
        </div>
      </div>
      {/* 관계 단계(스텝바) 상단 좌측에 작게 표시 + 우측에 호감도 */}
      <div style={{ background: "var(--color-card)", display: "flex", alignItems: "center", borderBottom: "1.5px solid var(--color-point)", padding: "0 0 0 0", position: "sticky", top: 56, zIndex: 9, minHeight: 36, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
          {STAGES.map((s, idx) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', opacity: idx === stageIdx ? 1 : 0.4, margin: '0 2px' }}>
              <span style={{ fontSize: 16, marginRight: 2 }}>{s.icon}</span>
              <span style={{ fontWeight: idx === stageIdx ? 700 : 500, color: idx === stageIdx ? '#ff4081' : '#bbb', fontSize: 14 }}>{s.label}</span>
              {idx < STAGES.length - 1 && <span style={{ margin: '0 2px', color: '#bbb' }}>/</span>}
            </div>
          ))}
        </div>
        <button
          style={{ marginRight: 16, background: 'none', border: 'none', color: '#ff4081', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '4px 12px', borderRadius: 8, transition: 'background 0.2s' }}
          onClick={() => setShowFavorModal(true)}
        >
          호감도: <span style={{ color: '#ff4081', fontWeight: 700 }}>{favor}점</span>
        </button>
      </div>
      {/* 스토리/메시지 영역 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 16px 0", display: "flex", flexDirection: "column" }}>
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
        {messages.map((msg, idx) => (
          <div key={idx} style={{ padding: "0 16px", marginBottom: 8 }}>
            <MessageBubble
              message={{
                ...msg,
                avatar: msg.sender === "ai"
                  ? msg.characterProfileImg || character.profileImg || "/avatars/default-profile.png"
                  : persona.avatar
              }}
              onProfileClick={() => {
                if (msg.sender === "ai") {
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
                    id: personaId,
                    name: persona.name,
                    avatar: persona.avatar
                  });
                }
              }}
            />
          </div>
        ))}
        {/* ChatGPT 스타일 로딩 인디케이터 */}
        {loading && (
          <div style={{ padding: '0 16px', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <div style={{
              background: '#222',
              color: '#fff',
              borderRadius: 18,
              padding: '6px 9px',
              fontSize: 9,
              display: 'inline-block',
              minWidth: 27,
              letterSpacing: 1,
              fontWeight: 500,
              boxShadow: '0 2px 8px #0002',
              marginLeft: 0
            }}>
              <span className="chat-loading-dots">●●●</span>
            </div>
            <style>{`
              .chat-loading-dots {
                display: inline-block;
                font-size: 11px;
                letter-spacing: 1px;
              }
              .chat-loading-dots:after {
                content: '';
                display: inline-block;
                width: 0;
                height: 0;
              }
              .chat-loading-dots {
                animation: chat-dots-blink 1.2s infinite steps(3);
              }
              @keyframes chat-dots-blink {
                0% { opacity: 1; }
                33% { opacity: 0.5; }
                66% { opacity: 0.2; }
                100% { opacity: 1; }
              }
            `}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* 입력 영역 */}
      <form onSubmit={handleSubmit} style={{ background: "var(--color-card)", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 24,
              border: "1px solid #eee",
              fontSize: 16,
              outline: "none"
            }}
        />
        <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "#f5f5f5" : "#ff4081",
              color: loading || !input.trim() ? "#bbb" : "#fff",
              border: "none",
              borderRadius: 24,
              padding: "0 24px",
              fontWeight: 700,
              fontSize: 16,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer"
            }}
        >
          전송
        </button>
        </div>
      </form>

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

      {/* 채팅 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3002,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowLeaveConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 18, minWidth: 280, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: '#ff4081', fontWeight: 700, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>채팅을 나가면 내용이 영구적으로 삭제 됩니다.<br/>정말 나가시겠습니까?</div>
            <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
              <button style={{ flex: 1, background: '#eee', color: '#ff4081', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }} onClick={() => setShowLeaveConfirm(false)}>취소</button>
              <button style={{ flex: 1, background: '#ff4081', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }} onClick={async () => {
                setShowLeaveConfirm(false);
                // 채팅방 DB 삭제
                await fetch('/api/chat', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: personaId, characterId: id })
                });
                navigate('/');
              }}>확인</button>
            </div>
          </div>
        </div>
      )}

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

