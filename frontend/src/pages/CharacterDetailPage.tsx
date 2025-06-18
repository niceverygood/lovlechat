import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from '../lib/openai';

interface Character {
  id: number;
  userId: string;
  profileImg: string;
  name: string;
  age: number;
  job: string;
  oneLiner: string;
  category: string;
  selectedTags: string[];
  backgroundImg?: string;
  firstMessage?: string;
  firstScene?: string;
  // ...필요한 필드
}

function CharacterDetailSkeleton() {
  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ width: "100%", height: 180, background: "#e0e0e0" }} />
      <div style={{ padding: "16px 20px 0 20px", display: "flex", gap: 8 }}>
        <div style={{ width: 60, height: 24, background: "#e0e0e0", borderRadius: 8, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: 60, height: 24, background: "#e0e0e0", borderRadius: 8, animation: "pulse 1.2s infinite" }} />
      </div>
      <div style={{ padding: "16px 20px 0 20px" }}>
        <div style={{ width: 120, height: 20, background: "#e0e0e0", borderRadius: 8, marginBottom: 12, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: "100%", height: 40, background: "#e0e0e0", borderRadius: 12, animation: "pulse 1.2s infinite" }} />
      </div>
      <div style={{ display: "flex", margin: "24px 0 0 0", borderBottom: "1.5px solid #f5b3d7" }}>
        <div style={{ flex: 1, height: 32, background: "#e0e0e0", borderRadius: 8, margin: 4, animation: "pulse 1.2s infinite" }} />
        <div style={{ flex: 1, height: 32, background: "#e0e0e0", borderRadius: 8, margin: 4, animation: "pulse 1.2s infinite" }} />
        <div style={{ flex: 1, height: 32, background: "#e0e0e0", borderRadius: 8, margin: 4, animation: "pulse 1.2s infinite" }} />
      </div>
      <div style={{ padding: "20px" }}>
        <div style={{ width: 100, height: 20, background: "#e0e0e0", borderRadius: 8, marginBottom: 12, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: "100%", height: 60, background: "#e0e0e0", borderRadius: 12, animation: "pulse 1.2s infinite" }} />
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ width: "100%", height: 40, background: "#e0e0e0", borderRadius: 12, marginBottom: 12, animation: "pulse 1.2s infinite" }} />
        <div style={{ color: "#bbb", fontSize: 15, textAlign: "center" }}>아직 등록된 사건이 없습니다.</div>
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 56, background: "#e0e0e0" }} />
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
    </div>
  );
}

export default function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);
  const [tab, setTab] = useState<'first' | 'story' | 'community'>('story');
  const [personas, setPersonas] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/character/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setCharacter(data.character);
      });
  }, [id]);

  useEffect(() => {
    if (!user?.uid) return;
    fetch(`${API_BASE_URL}/api/persona?userId=${user.uid}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setPersonas(data.personas.filter((p: any) => p.id !== user.uid));
      });
  }, [user?.uid]);

  useEffect(() => {
    if (personas.length > 0) setSelectedPersona(personas[0].id);
    else setSelectedPersona("");
  }, [personas, showPersonaModal]);

  // 채팅하기 버튼 클릭 시
  const handleChatClick = () => {
    setShowPersonaModal(true);
  };

  // 채팅 시작
  const handleStartChat = () => {
    setShowPersonaModal(false);
    navigate(`/chat/${id}?persona=${selectedPersona}`);
  };

  if (!character) return <CharacterDetailSkeleton />;

  // 해시태그 더보기 로직
  const TAGS_TO_SHOW = 8;
  const tags = character.selectedTags || [];
  const showTags = showAllTags ? tags : tags.slice(0, TAGS_TO_SHOW);
  const hasMoreTags = tags.length > TAGS_TO_SHOW;

  return (
    <div style={{ background: "#111", minHeight: "100vh", paddingBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 상단 3:4 비율 배경 이미지 */}
      <div style={{ position: "relative", width: "100%", maxWidth: 430, aspectRatio: "3/4", background: `url(${character.profileImg || "/avatars/default-profile.png"}) center/cover no-repeat`, overflow: "hidden", borderRadius: 18, margin: '0 auto', marginBottom: 24 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,0.38) 60%,rgba(0,0,0,0.85) 100%)" }} />
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', left: 16, top: 16, background: 'none', border: 'none', color: '#fff', fontSize: 28, zIndex: 2 }}>&larr;</button>
        {/* 프로필/이름/나이/직업 오버레이 */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: '0 0 32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
          <img
            src={character.profileImg || "/imgdefault.jpg"}
            alt={character.name}
            style={{ width: 92, height: 92, borderRadius: "50%", border: "3px solid #fff", objectFit: "cover", background: "#eee", marginBottom: 12 }}
            onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
          />
          <div style={{ fontWeight: 700, fontSize: 24, color: '#fff', marginBottom: 4, textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>{character.name}</div>
          <div style={{ fontWeight: 400, fontSize: 16, color: '#fff', opacity: 0.92, textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>{character.age ? `${character.age}살` : "나이 비공개"} · {character.job || "직업 비공개"}</div>
        </div>
      </div>
      {/* 한 마디 */}
      <div style={{ padding: "32px 20px 0 20px", width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', minHeight: 180, paddingBottom: 90, borderRadius: 18 }}>
        {/* 첫상황 */}
        <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 8 }}>첫상황</div>
        <div style={{ background: '#ffd6ea', color: '#ef4e8b', borderRadius: 18, padding: '24px 0', fontWeight: 600, fontSize: 22, textAlign: 'center', marginBottom: 28 }}>
          {character.firstScene || <span style={{ color: '#bbb', fontWeight: 400, fontSize: 18 }}>등록된 첫상황이 없습니다.</span>}
        </div>
        {/* 첫대사 */}
        <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 8 }}>첫대사</div>
        <div style={{ background: '#ffd6ea', color: '#ef4e8b', borderRadius: 18, padding: '24px 0', fontWeight: 600, fontSize: 22, textAlign: 'center', marginBottom: 28 }}>
          {character.firstMessage || <span style={{ color: '#bbb', fontWeight: 400, fontSize: 18 }}>등록된 첫대사가 없습니다.</span>}
        </div>
      </div>
      {/* 하단 고정 채팅하기 버튼 */}
      <button 
        onClick={handleChatClick}
        style={{
          position: "fixed", 
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 0, 
          height: 60, 
          width: '100%',
          maxWidth: 430,
          background: "#ff4081", 
          color: "#fff", 
          fontWeight: 700, 
          fontSize: 22, 
          border: "none", 
          borderRadius: '18px',
          cursor: "pointer",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.13)",
          zIndex: 100
        }}
      >
        채팅하기
      </button>
      {/* 페르소나 선택 모달 */}
      {showPersonaModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            position: 'relative',
            background: "#18171a",
            borderRadius: 20,
            padding: 24,
            width: "90%",
            maxWidth: 400,
            boxShadow: '0 4px 32px rgba(0,0,0,0.35)'
          }}>
            {/* X 버튼 */}
            <button
              onClick={() => setShowPersonaModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: 28,
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 2,
                padding: 4,
                borderRadius: '50%',
                transition: 'background 0.15s',
                lineHeight: 1,
              }}
              aria-label="닫기"
              tabIndex={0}
              onMouseOver={e => e.currentTarget.style.background = '#222'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16, color: '#eee', letterSpacing: -1 }}>페르소나 선택</div>
            {personas.map(p => (
              <div key={p.id} style={{ 
                background: selectedPersona === p.id ? "#2a1822" : "#222",
                borderRadius: 14, 
                padding: 18, 
                marginBottom: 12,
                cursor: "pointer",
                border: selectedPersona === p.id ? "2px solid #ff4081" : "1.5px solid #222",
                boxShadow: selectedPersona === p.id ? '0 2px 8px #ff408133' : 'none',
                color: selectedPersona === p.id ? '#ff4081' : '#eee',
                fontWeight: selectedPersona === p.id ? 700 : 500,
                transition: 'background 0.18s, border 0.18s, color 0.18s',
                display: 'flex', alignItems: 'center', gap: 16
              }} onClick={() => setSelectedPersona(p.id)}>
                <img
                  src={p.avatar || "/imgdefault.jpg"}
                  alt={p.name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: '#333', border: selectedPersona === p.id ? '2px solid #ff4081' : '2px solid #333', marginRight: 8 }}
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: selectedPersona === p.id ? '#ff4081' : '#fff' }}>{p.name}</div>
                  {/* DB 넘버(id)는 표시하지 않음 */}
                </div>
              </div>
            ))}
            {personas.length === 0 && (
              <div style={{ color: '#ff4081', fontWeight: 600, fontSize: 16, margin: '24px 0', textAlign: 'center' }}>멀티프로필을 먼저 생성해주세요.</div>
            )}
            {personas.length > 0 && (
              <button 
                onClick={handleStartChat}
                style={{
                  width: "100%",
                  background: "#ff4081",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: 16,
                  fontWeight: 700,
                  fontSize: 18,
                  marginTop: 8,
                  boxShadow: '0 2px 8px #ff408133',
                  cursor: "pointer"
                }}
              >채팅하기</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 



