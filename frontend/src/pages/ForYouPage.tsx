import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiHeart, FiPlus, FiEdit3, FiX } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from '../lib/openai';

interface Character {
  id: number;
  profileImg: string;
  name: string;
  age: number;
  job: string;
  oneLiner: string;
  backgroundImg?: string;
  firstScene?: string;
  firstMessage?: string;
  category?: string;
  userId?: string;
  selectedTags?: string[];
}

interface Persona {
  id: string;
  name: string;
  avatar: string;
}

// 프로필 이미지 경로 상수로 지정
const DEFAULT_PROFILE_IMG = "/imgdefault.jpg"; // 실제 파일 경로로 교체 필요

// 좋아요(하트) 상태 관리
const FAVOR_API = "/api/character/favor";

function ForYouSkeleton() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh" }}>
      <div style={{
        background: "#f3f3f3",
        borderRadius: 20,
        padding: 32,
        width: 320,
        maxWidth: "90vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)"
      }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "#e0e0e0", marginBottom: 20, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: 120, height: 24, borderRadius: 8, background: "#e0e0e0", marginBottom: 12, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: 180, height: 18, borderRadius: 8, background: "#e0e0e0", marginBottom: 16, animation: "pulse 1.2s infinite" }} />
        <div style={{ width: "100%", height: 48, borderRadius: 12, background: "#e0e0e0", marginTop: 16, animation: "pulse 1.2s infinite" }} />
      </div>
      <style>
        {`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}
      </style>
    </div>
  );
}

function CharacterDetailModal({ isOpen, onClose, character, onChatClick }: { isOpen: boolean, onClose: () => void, character: any, onChatClick?: () => void }) {
  const [tab, setTab] = React.useState(0);
  if (!isOpen || !character) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: 430, background: '#18171a', borderRadius: 22, boxShadow: '0 4px 32px #0007', position: 'relative', margin: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
        {/* 상단 배경 이미지 및 뒤로가기 버튼 */}
        <button onClick={onClose} style={{ position: 'absolute', left: 18, top: 18, background: 'rgba(0,0,0,0.32)', border: 'none', fontSize: 28, color: '#fff', cursor: 'pointer', zIndex: 21, padding: '4px 12px', borderRadius: 18, lineHeight: 1 }} aria-label="뒤로가기">←</button>
        <div style={{ width: '100%', aspectRatio: '3/4', background: '#222', position: 'relative', overflow: 'hidden' }}>
          <img
            src={character.profileImg || DEFAULT_PROFILE_IMG}
            alt={character.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 1, filter: 'brightness(0.92)' }}
            onError={e => {
              if (e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) return;
              e.currentTarget.onerror = null;
              e.currentTarget.src = DEFAULT_PROFILE_IMG;
            }}
          />
        {/* 카테고리, by */}
          <div style={{ position: 'absolute', left: 18, top: 18, display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
            <span style={{ background: '#ffb3d1', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '4px 10px' }}>{character.category || '카테고리 없음'}</span>
            <span style={{ color: '#fff', fontWeight: 500, fontSize: 15, opacity: 0.85 }}>by. 제작자</span>
        </div>
        </div>
        {/* 프로필, 이름, 나이/직업 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -32, zIndex: 3, width: '100%' }}>
          <img
            src={character.profileImg || DEFAULT_PROFILE_IMG}
            alt={character.name}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', background: '#eee', marginBottom: 8, boxShadow: '0 2px 12px #0003' }}
            onError={e => {
              if (e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) return;
              e.currentTarget.onerror = null;
              e.currentTarget.src = DEFAULT_PROFILE_IMG;
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 2 }}>{character.name}</div>
          <div style={{ fontSize: 16, color: '#ccc', marginBottom: 10 }}>{character.age}살 · {character.job}</div>
        </div>
        {/* 첫상황/첫대사 */}
          {character.firstScene && (
          <div style={{ fontSize: 15, color: '#bbb', margin: '0 0 4px 0', textAlign: 'center', maxWidth: 320 }}>{character.firstScene}</div>
          )}
          {character.firstMessage && (
          <div style={{ fontSize: 17, color: '#fff', fontWeight: 500, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 16px', margin: '0 0 8px 0', textAlign: 'center', maxWidth: 320 }}>{character.firstMessage}</div>
          )}
        {/* 태그 */}
        {character.selectedTags && character.selectedTags.length > 0 && (
          <div style={{ padding: '8px 20px 0 20px', display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
            {character.selectedTags.map((tag: string) => (
              <span key={tag} style={{ background: '#ffd6ea', color: '#ff4081', borderRadius: 8, padding: '4px 10px', fontWeight: 600, fontSize: 14 }}>#{tag}</span>
            ))}
        </div>
        )}
        {/* 탭 */}
        <div style={{ display: 'flex', margin: '24px 0 0 0', borderBottom: '1.5px solid #f5b3d7', width: '100%' }}>
          <div onClick={() => setTab(0)} style={{ flex: 1, textAlign: 'center', padding: 12, fontWeight: 700, color: tab === 0 ? '#ff4081' : '#bbb', borderBottom: tab === 0 ? '2.5px solid #ff4081' : 'none', cursor: 'pointer' }}>서사</div>
          <div onClick={() => setTab(1)} style={{ flex: 1, textAlign: 'center', padding: 12, fontWeight: 700, color: tab === 1 ? '#ff4081' : '#bbb', borderBottom: tab === 1 ? '2.5px solid #ff4081' : 'none', cursor: 'pointer' }}>첫 장면</div>
          <div onClick={() => setTab(2)} style={{ flex: 1, textAlign: 'center', padding: 12, fontWeight: 700, color: tab === 2 ? '#ff4081' : '#bbb', borderBottom: tab === 2 ? '2.5px solid #ff4081' : 'none', cursor: 'pointer' }}>커뮤니티</div>
        </div>
        {/* 탭 내용 */}
        <div style={{ padding: '20px', width: '100%', paddingBottom: 90 }}>
          {tab === 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#fff' }}>{character.name}의 서사</div>
              <div style={{ background: '#232124', borderRadius: 12, padding: 16, fontWeight: 500, color: '#fff', fontSize: 16 }}>{character.firstScene || '등록된 서사가 없습니다.'}</div>
            </>
          )}
          {tab === 1 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#fff' }}>첫 상황</div>
              <div style={{ background: '#232124', borderRadius: 12, padding: 16, fontWeight: 500, color: '#fff', fontSize: 16, marginBottom: 16 }}>{character.firstScene || '등록된 첫 상황이 없습니다.'}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#fff' }}>채팅 첫 마디</div>
              <div style={{ background: '#232124', borderRadius: 12, padding: 16, fontWeight: 500, color: '#fff', fontSize: 16 }}>{character.firstMessage || '등록된 첫 마디가 없습니다.'}</div>
            </>
          )}
          {tab === 2 && (
            <>
              <div style={{ background: '#232124', borderRadius: 12, padding: 32, fontWeight: 700, color: '#ff4081', fontSize: 18, textAlign: 'center' }}>준비중</div>
            </>
          )}
        </div>
        {/* 하단 고정 채팅하기 버튼 */}
        <button
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 18, height: 56, width: '90%', maxWidth: 370, background: '#ff4081', color: '#fff', fontWeight: 700, fontSize: 20, border: 'none', borderRadius: 18, cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 12px #ff408133'
          }}
          onClick={onChatClick}
        >채팅하기</button>
        {/* 닫기 버튼 */}
        <button onClick={onClose} style={{ position: 'absolute', right: 18, top: 18, background: 'none', border: 'none', fontSize: 28, color: '#fff', cursor: 'pointer', zIndex: 20 }}>✖️</button>
      </div>
    </div>
  );
}

export default function ForYouPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showPersonaManager, setShowPersonaManager] = useState(false);
  const [showPersonaCreator, setShowPersonaCreator] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [addingPersona, setAddingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaAvatar, setNewPersonaAvatar] = useState<string>("");
  const [creatorProfileImg, setCreatorProfileImg] = useState<string>("");
  const [creatorGender, setCreatorGender] = useState("밝히지 않음");
  const [creatorName, setCreatorName] = useState("");
  const [creatorAge, setCreatorAge] = useState("");
  const [creatorJob, setCreatorJob] = useState("");
  const [creatorInfo, setCreatorInfo] = useState("");
  const [creatorHabit, setCreatorHabit] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [showProfileCreateModal, setShowProfileCreateModal] = useState(false);
  const navigate = useNavigate();
  const [introLoading, setIntroLoading] = useState(true);
  const [likedCharacters, setLikedCharacters] = useState<number[]>([]);
  const { user } = useAuth();
  const userId = user?.uid || "";
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveDetailCharacter, setArchiveDetailCharacter] = useState<Character | null>(null);
  const [showArchiveDetailModal, setShowArchiveDetailModal] = useState(false);

  // 좋아요한 캐릭터 목록 불러오기
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE_URL}/api/character/favor?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.liked)) setLikedCharacters(data.liked);
      });
  }, [userId]);

  // 하트(좋아요) 토글
  const handleToggleLike = async (characterId: number) => {
    if (!userId) return;
    const liked = likedCharacters.includes(characterId);
    if (!liked) {
      // 좋아요 추가
      await fetch(FAVOR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, characterId })
      });
      setLikedCharacters(prev => [...prev, characterId]);
    } else {
      // 좋아요 취소
      await fetch(FAVOR_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, characterId })
      });
      setLikedCharacters(prev => prev.filter(id => id !== characterId));
    }
  };

  // 프로필 사진 업로드
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handleProfileImgClick = () => fileInputRef.current?.click();
  const handleProfileImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCreatorProfileImg(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 멀티프로필 목록 불러오기 (GET)
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE_URL}/api/persona?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.personas)) setPersonas(data.personas);
        else setPersonas([]);
      })
      .catch(() => setPersonas([]));
  }, [userId, showPersonaManager, showPersonaCreator]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/character`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setCharacters(data.characters);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (showPersonaCreator) {
      setCreatorProfileImg("");
      setCreatorGender("밝히지 않음");
      setCreatorName("");
      setCreatorAge("");
      setCreatorJob("");
      setCreatorInfo("");
      setCreatorHabit("");
    }
  }, [showPersonaCreator]);

  useEffect(() => {
    setIntroLoading(true);
    const timer = setTimeout(() => setIntroLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? characters.length - 1 : prev - 1));
  };
  const handleNext = () => {
    setIndex((prev) => (prev === characters.length - 1 ? 0 : prev + 1));
  };

  // 터치 스와이프 지원
  let touchStartX = 0;
  let touchEndX = 0;
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.changedTouches[0].screenX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchEndX - touchStartX > 50) handlePrev();
    else if (touchStartX - touchEndX > 50) handleNext();
  };

  // 채팅하기 버튼 클릭 시
  const handleChatClick = () => {
    if (multiPersonas.length === 0) {
      setShowPersonaCreator(true);
      return;
    }
    setShowPersonaModal(true);
  };

  // 페르소나 추가
  const handleAddPersona = () => {
    if (!newPersonaName) return;
    setPersonas(prev => [
      ...prev,
      { id: newPersonaName, name: newPersonaName, avatar: newPersonaAvatar || "/imgdefault.jpg" }
    ]);
    setSelectedPersona(newPersonaName);
    setNewPersonaName("");
    setNewPersonaAvatar("");
    setAddingPersona(false);
  };

  // 멀티프로필 생성 완료 (POST)
  const handlePersonaCreate = async () => {
    if (!userId) return;
    if (!creatorName) return alert("이름을 입력해주세요");
    const payload = {
      userId,
      name: creatorName,
      avatar: creatorProfileImg || "/imgdefault.jpg",
      gender: creatorGender,
      age: creatorAge,
      job: creatorJob,
      info: creatorInfo,
      habit: creatorHabit,
    };
    const res = await fetch(`${API_BASE_URL}/api/persona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      setShowPersonaCreator(false);
      setShowPersonaManager(false);
      // 폼 초기화는 useEffect에서 처리
    } else {
      alert("프로필 저장 실패: " + data.error);
    }
  };

  // 멀티프로필 삭제 (DELETE)
  const handleDeletePersona = async (id: string) => {
    if (!userId) return;
    if (id === userId) return; // 기본 프로필은 삭제 불가
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      await fetch(`${API_BASE_URL}/api/persona/${id}`, { method: "DELETE" });
      setPersonas(prev => prev.filter(p => p.id !== id));
      if (selectedPersona === id && personas.length > 1) {
        setSelectedPersona(personas[0].id);
      }
    }
  };

  // 채팅 시작
  const handleStartChat = () => {
    setShowPersonaModal(false);
    if (selectedPersona === userId) {
      alert("기본 프로필은 선택할 수 없습니다.");
    } else {
      navigate(`/chat/${characters[index].id}?persona=${selectedPersona}`);
    }
  };

  // 캐릭터 카드 클릭 시 상세로 이동
  const handleCardClick = (id: number) => {
    navigate(`/character/${id}`);
  };

  // 멀티프로필만 추출 (id, name 둘 다 체크)
  const multiPersonas = personas.filter(
    p => p.id !== userId && p.name !== userId && p.name !== "user_74127"
  );

  // 기본 프로필(관리계정) 추출
  const defaultPersona = personas.find(p => p.id === userId);
  // localStorage에서 유저 이름 가져오기
  let localUserName = undefined;
  try {
    const savedUserProfile = localStorage.getItem('userProfile');
    if (savedUserProfile) {
      const profile = JSON.parse(savedUserProfile);
      localUserName = profile.name;
    }
  } catch (e) {}

  // 멀티프로필 관리 모달 내부
  const PersonaManager = () => {
    const managedPersonas = personas.filter(
      p => p.id !== userId && p.name !== userId
    );
    return (
    <div style={{
        position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", background: "rgba(20,20,20,0.98)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 430, background: '#18171a', borderRadius: 18, boxShadow: '0 2px 16px #0005', minHeight: 480, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <div style={{ display: "flex", alignItems: "center", padding: "18px 20px 10px 20px", borderBottom: "1px solid #222", justifyContent: 'space-between', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setShowPersonaManager(false)} style={{ background: "none", border: "none", fontSize: 26, marginRight: 8, cursor: "pointer", color: "#fff" }}>&larr;</button>
              <span style={{ fontWeight: 700, fontSize: 22, color: '#fff' }}>멀티프로필</span>
      </div>
        <button
              onClick={() => setShowProfileCreateModal(true)}
              disabled={managedPersonas.length >= 10}
              style={{ display: "flex", alignItems: "center", background: "none", border: "none", color: managedPersonas.length >= 10 ? "#888" : "#ff4081", fontWeight: 600, fontSize: 18, cursor: managedPersonas.length >= 10 ? "not-allowed" : "pointer" }}
              title={managedPersonas.length >= 10 ? '최대 10개까지 생성할 수 있습니다.' : ''}
        >
              <span style={{ fontSize: 26, marginRight: 4 }}>+</span> 만들기 ({managedPersonas.length}/10)
        </button>
          </div>
          <div style={{ padding: 24 }}>
            {managedPersonas.length === 0 && (
          <div style={{ color: "#bbb", fontSize: 16, marginTop: 40 }}>아직 등록된 프로필이 없습니다.</div>
        )}
            {managedPersonas.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", background: "#232124", borderRadius: 16, padding: '18px 16px', marginBottom: 18, boxShadow: '0 2px 8px #0002', minHeight: 68 }}>
            <img
                  src={p.avatar || "/imgdefault.jpg"}
              alt={p.name}
                  style={{ width: 54, height: 54, borderRadius: "50%", marginRight: 18, objectFit: "cover", boxShadow: '0 2px 8px #0002' }}
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
            />
                <span style={{ fontWeight: 700, fontSize: 19, color: '#fff' }}>{p.name}</span>
                <button onClick={() => handleProfileEdit(p)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ff4081", fontSize: 18, fontWeight: 600, cursor: "pointer", padding: '0 8px' }}>수정</button>
                <button onClick={() => handleDeletePersona(p.id)} style={{ background: "none", border: "none", color: "#ff4081", fontSize: 26, fontWeight: 700, cursor: "pointer", padding: '0 4px' }}>✕</button>
          </div>
        ))}
          </div>
      </div>
    </div>
  );
  };

  // 멀티프로필 생성 폼 전체화면
  const PersonaCreator = ({
    creatorProfileImg,
    handleProfileImgClick,
    fileInputRef,
    handleProfileImgChange,
    creatorGender,
    setCreatorGender,
    creatorName,
    setCreatorName,
    creatorAge,
    setCreatorAge,
    creatorJob,
    setCreatorJob,
    creatorInfo,
    setCreatorInfo,
    creatorHabit,
    setCreatorHabit,
    handlePersonaCreate,
    setShowPersonaCreator
  }: any) => (
    <div style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", background: "var(--color-card)", zIndex: 3000, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px 20px" }}>
        <button onClick={() => setShowPersonaCreator(false)} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: "#fff" }}>&larr;</button>
        <span></span>
        <button onClick={handlePersonaCreate} style={{ background: "none", border: "none", color: "#ff4081", fontWeight: 700, fontSize: 20, cursor: "pointer" }}>완료</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
        <div style={{ position: "relative", width: 110, height: 110, marginBottom: 16 }}>
          <img
            src={creatorProfileImg || "/imgdefault.jpg"}
            alt="프로필"
            style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", background: "#ffe5e5" }}
          />
          <button
            type="button"
            onClick={handleProfileImgClick}
            style={{
              position: "absolute", right: 0, bottom: 0, background: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer"
            }}
            aria-label="프로필 사진 변경"
          >
            <span role="img" aria-label="edit">✏️</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleProfileImgChange}
          />
        </div>
      </div>
      <div style={{ padding: "0 20px", marginTop: 8 }}>
        {/* 성별 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>성별</div>
        <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
          {['남성', '여성', '밝히지 않음'].map(g => (
            <label key={g} style={{ display: "flex", alignItems: "center", fontWeight: 500, fontSize: 16 }}>
              <input type="radio" checked={creatorGender === g} onChange={() => setCreatorGender(g)} style={{ marginRight: 6 }} /> {g}
            </label>
          ))}
        </div>
        {/* 이름 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>이름 <span style={{ color: '#888', fontWeight: 400, fontSize: 14 }}>(필수)</span></div>
        <input
          placeholder="이름을 입력해주세요"
          value={creatorName}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 15) setCreatorName(v);
            else setCreatorName(v.slice(0, 15));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", padding: 14, fontSize: 16, marginBottom: 2, background: '#fafafa' }}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 12 }}>{creatorName.length}/15</div>
        {/* 나이 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>나이</div>
        <input
          placeholder="나이를 입력해주세요"
          value={creatorAge}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 15) setCreatorAge(v);
            else setCreatorAge(v.slice(0, 15));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", padding: 14, fontSize: 16, marginBottom: 2, background: '#fafafa' }}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 12 }}>{creatorAge.length}/15</div>
        {/* 직업 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>직업</div>
        <input
          placeholder="직업을 입력해주세요"
          value={creatorJob}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 15) setCreatorJob(v);
            else setCreatorJob(v.slice(0, 15));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", padding: 14, fontSize: 16, marginBottom: 2, background: '#fafafa' }}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 12 }}>{creatorJob.length}/15</div>
        {/* 기본 정보 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>기본 정보</div>
        <textarea
          placeholder="외모, 성격 등 기본 정보를 알려주세요"
          value={creatorInfo}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 500) setCreatorInfo(v);
            else setCreatorInfo(v.slice(0, 500));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", padding: 14, fontSize: 16, marginBottom: 2, background: '#fafafa', resize: 'none' }}
          rows={3}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 12 }}>{creatorInfo.length}/500</div>
        {/* 습관적 말과 행동 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>습관적인 말과 행동</div>
        <textarea
          placeholder="예시를 입력해주세요"
          value={creatorHabit}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 500) setCreatorHabit(v);
            else setCreatorHabit(v.slice(0, 500));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", padding: 14, fontSize: 16, marginBottom: 2, background: '#fafafa', resize: 'none' }}
          rows={3}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 12 }}>{creatorHabit.length}/500</div>
      </div>
    </div>
  );

  const handleProfileEdit = (profile: any) => {
    console.log('수정 클릭', profile);
    setEditProfile(profile);
    setShowProfileEditModal(true);
  };

  const handleProfileSave = async (updatedProfile: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/persona/${updatedProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedProfile.name,
          gender: updatedProfile.gender,
          age: updatedProfile.age,
          job: updatedProfile.job,
          info: updatedProfile.info,
          habit: updatedProfile.habit,
          avatar: updatedProfile.avatar || '/imgdefault.jpg'
        }),
      });
      if (response.ok) {
        setPersonas(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
        setShowProfileEditModal(false);
        setEditProfile(null);
        alert('프로필이 성공적으로 수정되었습니다.');
      } else {
        throw new Error('프로필 수정에 실패했습니다.');
      }
    } catch (error) {
      alert('프로필 수정 중 오류가 발생했습니다.');
    }
  };

  const handleProfileCreate = async (newProfile: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: newProfile.name,
          gender: newProfile.gender,
          age: newProfile.age,
          job: newProfile.job,
          info: newProfile.info,
          habit: newProfile.habit,
          avatar: newProfile.avatar
        }),
      });
      if (response.ok) {
        setShowProfileCreateModal(false);
        setShowPersonaManager(false);
        // 목록 갱신
        fetch(`${API_BASE_URL}/api/persona?userId=${userId}`)
          .then(res => res.json())
          .then(data => { if (data.ok) setPersonas(data.personas); });
        alert('프로필이 성공적으로 생성되었습니다.');
      } else {
        throw new Error('프로필 생성에 실패했습니다.');
      }
    } catch (error) {
      alert('프로필 생성 중 오류가 발생했습니다.');
    }
  };

  // selectedPersona의 기본값 설정 부분
  useEffect(() => {
    if (multiPersonas.length > 0) {
      // 현재 선택된 프로필이 목록에 없으면만 첫 번째로 초기화
      if (!multiPersonas.some(p => p.id === selectedPersona)) {
        setSelectedPersona(multiPersonas[0].id);
      }
    } else {
      setSelectedPersona("");
    }
    // eslint-disable-next-line
  }, [multiPersonas, showPersonaModal]);

  return (
    <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 80 }}>
      <div style={{ position: 'relative', padding: "24px 20px 0 20px", width: '100%', maxWidth: 430, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 24, color: '#fff', letterSpacing: 1 }}>FOR YOU ♥</span>
        <span
          style={{ position: 'absolute', right: 20, top: 24, fontSize: 26, color: '#ffb3d1', cursor: 'pointer' }}
          title="보관함"
          onClick={() => setShowArchiveModal(true)}
        >🗂️</span>
      </div>
      {introLoading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", width: "100%" }}>
          <div style={{
            width: 64, height: 64, border: "6px solid #ffb6d5", borderTop: "6px solid #ff4081", borderRadius: "50%",
            animation: "spin 1s linear infinite", marginBottom: 32
          }} />
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
            {(localUserName || defaultPersona?.name || user?.displayName || "사용자")}님과 어울리는 캐릭터를 찾고 있습니다
          </div>
          <style>{`@keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }`}</style>
        </div>
      ) : loading ? (
        <ForYouSkeleton />
      ) : characters.length === 0 ? (
        <div style={{ padding: 20, color: "#888" }}>저장된 캐릭터가 없습니다.</div>
      ) : (
        <div
          style={{
            position: "relative",
            width: 360,
            height: 540,
            borderRadius: 32,
            overflow: "hidden",
            background: "#111",
            boxShadow: "0 4px 32px rgba(0,0,0,0.25)",
            margin: "0 auto"
          }}
        >
          {/* 배경 이미지 + 어둡게 */}
          <img
            src={characters[index].backgroundImg || characters[index].profileImg || DEFAULT_PROFILE_IMG}
            alt="bg"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", filter: "brightness(0.6) blur(1.5px)", zIndex: 1
            }}
            onError={e => { if (!e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PROFILE_IMG; } }}
          />
          {/* 상단 정보 */}
            <div style={{
            position: "absolute", top: 28, left: 24, zIndex: 3, color: "#fff", textAlign: "left", display: "flex", alignItems: "center"
          }}>
              <img
                src={characters[index].profileImg || DEFAULT_PROFILE_IMG}
                alt={characters[index].name}
              style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover", background: "#eee", marginRight: 14, cursor: 'pointer' }}
              onClick={() => handleCardClick(characters[index].id)}
              onError={e => { if (!e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PROFILE_IMG; } }}
              />
            <div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>{characters[index].name}</div>
              <div style={{ fontSize: 15, opacity: 0.85 }}>{characters[index].age ? characters[index].age : "-"} | {characters[index].job || "-"}</div>
            </div>
          </div>
          {/* 첫상황설명 */}
              {characters[index].firstScene && (
            <div style={{
              position: "absolute", top: 90, left: 24, right: 24, color: "#fff",
              background: "rgba(0,0,0,0.35)", borderRadius: 12, padding: "12px 16px",
              fontSize: 15, fontWeight: 400, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", zIndex: 3,
              textAlign: 'center'
            }}>
                  {characters[index].firstScene}
                </div>
              )}
          {/* 첫대사(말풍선) - 첫상황 바로 아래 중앙 정렬 */}
              {characters[index].firstMessage && (
            <div style={{
              position: "absolute", left: '50%', top: 150, transform: 'translateX(-50%)', background: "#8888", color: "#fff",
              borderRadius: 22, padding: "12px 24px", fontSize: 16, fontWeight: 500, maxWidth: 260, zIndex: 3,
              textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
            }}>
                  {characters[index].firstMessage}
                </div>
              )}
          {/* 하트/제작자 */}
          <div style={{
            position: "absolute", right: 24, bottom: 90, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3
          }}>
            <span
              style={{ fontSize: 32, color: likedCharacters.includes(characters[index].id) ? "#ff4081" : "#ffb3d1", marginBottom: 6, cursor: 'pointer', transition: 'color 0.2s' }}
              onClick={() => handleToggleLike(characters[index].id)}
              title={likedCharacters.includes(characters[index].id) ? '좋아요 취소' : '좋아요'}
            >{likedCharacters.includes(characters[index].id) ? '♥' : '♡'}</span>
            <img src={characters[index].profileImg || DEFAULT_PROFILE_IMG} alt="제작자" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "#eee" }} onError={e => { if (!e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_PROFILE_IMG; } }} />
            <div style={{ color: "#fff", fontSize: 13, marginTop: 2 }}>제작자</div>
            </div>
          {/* 채팅 시작하기 버튼 */}
            <button
              style={{
              position: "absolute", left: 24, right: 24, bottom: 24, height: 54,
              background: "#ff4081", color: "#fff", border: "none", borderRadius: 28,
              fontWeight: 700, fontSize: 20, boxShadow: "0 2px 8px #ff408155", cursor: "pointer", zIndex: 4
            }}
            onClick={() => setShowPersonaModal(true)}
          >채팅 시작하기</button>
          {/* 왼쪽(이전) 버튼 */}
          <button
            onClick={handlePrev}
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10,
              width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.32)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", cursor: "pointer", transition: "background 0.2s"
              }}
            aria-label="이전 캐릭터"
            onMouseOver={e => e.currentTarget.style.background = "rgba(0,0,0,0.5)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(0,0,0,0.32)"}
          >
            &#60;
          </button>
          {/* 오른쪽(다음) 버튼 */}
          <button
            onClick={handleNext}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10,
              width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.32)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", cursor: "pointer", transition: "background 0.2s"
            }}
            aria-label="다음 캐릭터"
            onMouseOver={e => e.currentTarget.style.background = "rgba(0,0,0,0.5)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(0,0,0,0.32)"}
          >
            &#62;
          </button>
        </div>
      )}
      {/* 페르소나 선택 전체화면 모달 */}
      {showPersonaModal && (
        <div style={{
          position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", background: "#111", zIndex: 1500, display: "flex", flexDirection: "column", alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420, background: '#18171a', borderRadius: 18, boxShadow: '0 2px 16px #0005', minHeight: 480, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 10px 16px", borderBottom: "1px solid #222", background: '#111', position: 'sticky', top: 0, zIndex: 2 }}>
            <button onClick={() => setShowPersonaModal(false)} style={{ background: "none", border: "none", fontSize: 26, marginRight: 8, cursor: "pointer", color: "#fff" }}>&larr;</button>
              <span style={{ fontWeight: 700, fontSize: 22, color: "#fff" }}>채팅 프로필</span>
          </div>
            <div style={{ padding: 18, flex: 1, overflowY: "auto" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#fff" }}>멀티프로필</div>
              <div style={{ color: "#bbb", fontSize: 14, marginBottom: 18 }}>직업과 기본 정보를 추가 지원합니다</div>
              {multiPersonas.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", background: selectedPersona === p.id ? "#2a1a22" : "#18171a", borderRadius: 18, padding: '20px 16px', marginBottom: 18, cursor: "pointer", minHeight: 72, boxShadow: selectedPersona === p.id ? '0 2px 12px #ff408122' : 'none', transition: 'background 0.2s' }} onClick={() => setSelectedPersona(p.id)}>
                <img
                    src={p.avatar || "/imgdefault.jpg"}
                  alt={p.name}
                    style={{ width: 56, height: 56, borderRadius: "50%", marginRight: 18, objectFit: "cover", boxShadow: '0 2px 8px #0002' }}
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
                />
                  <span style={{ fontWeight: 700, fontSize: 20, color: "#fff", letterSpacing: 0.5 }}>{p.name}</span>
                  {selectedPersona === p.id && <span style={{ marginLeft: "auto", color: "#ff4081", fontSize: 32, fontWeight: 900 }}>✔️</span>}
              </div>
            ))}
              {multiPersonas.length === 0 && (
                <div style={{ color: '#ff4081', fontWeight: 600, fontSize: 16, margin: '32px 0', textAlign: 'center' }}>멀티프로필을 먼저 생성해주세요.</div>
              )}
              <button onClick={() => setShowPersonaManager(true)} style={{ width: "100%", background: "#18141a", color: "#ff4081", border: "1.5px solid #ff4081", borderRadius: 16, padding: '16px 0', fontWeight: 700, fontSize: 18, marginTop: 10, marginBottom: 18, boxShadow: '0 2px 8px #ff408122' }}>+ 프로필 추가/관리</button>
              {multiPersonas.length > 0 && (
                <button onClick={handleStartChat} style={{ width: "100%", background: "#ff4081", color: "#fff", border: "none", borderRadius: 16, padding: '18px 0', fontWeight: 700, fontSize: 20, marginTop: 8, boxShadow: '0 2px 12px #ff408133' }}>채팅하기</button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 멀티프로필 관리 전체화면 모달 */}
      {showPersonaManager && <PersonaManager />}
      {showPersonaCreator && (
        <PersonaCreator
          creatorProfileImg={creatorProfileImg}
          handleProfileImgClick={handleProfileImgClick}
          fileInputRef={fileInputRef}
          handleProfileImgChange={handleProfileImgChange}
          creatorGender={creatorGender}
          setCreatorGender={setCreatorGender}
          creatorName={creatorName}
          setCreatorName={setCreatorName}
          creatorAge={creatorAge}
          setCreatorAge={setCreatorAge}
          creatorJob={creatorJob}
          setCreatorJob={setCreatorJob}
          creatorInfo={creatorInfo}
          setCreatorInfo={setCreatorInfo}
          creatorHabit={creatorHabit}
          setCreatorHabit={setCreatorHabit}
          handlePersonaCreate={handlePersonaCreate}
          setShowPersonaCreator={setShowPersonaCreator}
        />
      )}
      {/* 프로필 상세 모달 */}
      <CharacterDetailModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        character={selectedProfile}
        onChatClick={() => {
          setShowProfileModal(false);
          setTimeout(() => setShowPersonaModal(true), 200);
        }}
      />
      {/* 프로필 수정 모달 */}
      {console.log('ProfileEditModal 조건', showProfileEditModal, editProfile)}
      {showProfileEditModal && editProfile && (
        <ProfileEditModal
          isOpen={showProfileEditModal}
          onClose={() => { setShowProfileEditModal(false); setEditProfile(null); }}
          profileData={{
            id: editProfile.id,
            name: editProfile.name,
            gender: editProfile.gender || '',
            age: editProfile.age ? parseInt(editProfile.age) : 0,
            job: editProfile.job || '',
            info: editProfile.info || '',
            habit: editProfile.habit || '',
            avatar: editProfile.avatar || '/imgdefault.jpg'
          }}
          onSave={handleProfileSave}
        />
      )}
      {/* 멀티프로필 생성 모달 */}
      {showProfileCreateModal && (
        <ProfileEditModal
          isOpen={showProfileCreateModal}
          onClose={() => setShowProfileCreateModal(false)}
          profileData={{
            id: '',
            name: '',
            gender: '',
            age: 0,
            job: '',
            info: '',
            habit: '',
            avatar: '/imgdefault.jpg'
          }}
          onSave={handleProfileCreate}
          mode="create"
        />
      )}
      {/* 보관함 모달 */}
      {showArchiveModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '100%', maxWidth: 400, background: '#18171a', borderRadius: 18, boxShadow: '0 2px 16px #0005', minHeight: 320, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <button onClick={() => setShowArchiveModal(false)} style={{ position: 'absolute', right: 18, top: 18, background: 'none', border: 'none', fontSize: 26, color: '#ff4081', cursor: 'pointer' }}>✖️</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 18 }}>보관함</div>
            {likedCharacters.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 16, marginTop: 40 }}>좋아요한 캐릭터가 없습니다.</div>
            ) : (
              <div style={{ width: '100%' }}>
                {characters.filter(c => likedCharacters.includes(c.id)).map(c => (
                  <div
                    key={c.id}
                    style={{ display: 'flex', alignItems: 'center', background: '#232124', borderRadius: 14, padding: '14px 12px', marginBottom: 14, boxShadow: '0 2px 8px #0002', cursor: 'pointer' }}
                    onClick={() => { setArchiveDetailCharacter(c); setShowArchiveDetailModal(true); }}
                  >
                    <img src={c.profileImg || DEFAULT_PROFILE_IMG} alt={c.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginRight: 14 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>{c.name}</div>
                      <div style={{ color: '#bbb', fontSize: 14 }}>{c.age ? `${c.age}살` : '-'} | {c.job || '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 보관함 캐릭터 상세 모달 */}
      {showArchiveDetailModal && archiveDetailCharacter && (
        <CharacterDetailModal
          isOpen={showArchiveDetailModal}
          onClose={() => setShowArchiveDetailModal(false)}
          character={archiveDetailCharacter}
          onChatClick={() => {
            setShowArchiveDetailModal(false);
            setTimeout(() => setShowPersonaModal(true), 200);
          }}
        />
      )}
      <BottomNav />
    </div>
  );
} 