import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiHeart, FiPlus, FiX } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import { apiGet, apiPost, apiPut, apiDelete, API_BASE_URL } from '../lib/api';
import CustomAlert from '../components/CustomAlert';
import LoginPromptModal from '../components/LoginPromptModal';
import { isGuestMode, GUEST_LIMITS, getGuestLimitMessage } from '../utils/guestMode';
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';

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

// 개념 정리:
// - User: 구글 로그인한 실제 사용자 1명 (Firebase Auth uid)
// - Persona: User가 만드는 여러 개의 프로필 (UI에서 "멀티프로필"로 표시)
// - Character: AI 상대방 캐릭터
interface Persona {
  id: string;
  name: string;
  avatar: string;
}

// 프로필 이미지 경로 상수로 지정
const DEFAULT_PROFILE_IMG = DEFAULT_PROFILE_IMAGE;

// 좋아요(하트) 상태 관리
const FAVOR_API = '/api/character/favor';

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
            src={(() => {
              const bg = character.backgroundImg;
              const profile = character.profileImg;
              // backgroundImg가 null, undefined, 빈 문자열이면 profileImg 사용
              if (!bg || bg.trim() === '') {
                return profile || DEFAULT_PROFILE_IMG;
              }
              return bg;
            })()}
            alt={character.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 1, filter: 'brightness(0.92)' }}
            onError={handleProfileImageError}
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
            onError={handleProfileImageError}
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

// 오버레이용 간단한 spinner 컴포넌트
function Spinner() {
  return (
    <div style={{ width: 48, height: 48, border: '6px solid #fff', borderTop: '6px solid #ff4081', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
  const [creatorLoading, setCreatorLoading] = useState(false);
  // 복잡한 필드들 제거됨 (persona는 간단한 프로필만)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [showProfileCreateModal, setShowProfileCreateModal] = useState(false);
  const navigate = useNavigate();
  const [introLoading, setIntroLoading] = useState(true);
  const [likedCharacters, setLikedCharacters] = useState<number[]>([]);
  const [likedCharacterDetails, setLikedCharacterDetails] = useState<Character[]>([]);
  const { user } = useAuth(); // Firebase Auth 사용자 객체
  const userId = user?.uid || ""; // 구글 로그인한 User의 고유 ID (Firebase uid)
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveDetailCharacter, setArchiveDetailCharacter] = useState<Character | null>(null);
  const [showArchiveDetailModal, setShowArchiveDetailModal] = useState(false);
  const [timer, setTimer] = useState<string>("01:00:00");
  const [remainSeconds, setRemainSeconds] = useState<number>(3600);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  
  // Confirm 다이얼로그 상태
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  
  // 로그인 유도 모달
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // 하트 시스템
  const { hearts, loading: heartsLoading, error: heartsError, refreshHearts } = useHearts(userId);
  const [refreshingCharacters, setRefreshingCharacters] = useState(false);

  // 하트 에러 처리
  useEffect(() => {
    if (heartsError) {
      setAlertTitle('하트 오류');
      setAlertMsg(heartsError);
      setAlertOpen(true);
    }
  }, [heartsError]);

  // 좋아요한 캐릭터 목록 불러오기
  const loadLikedCharacters = async () => {
    if (!userId) return;
    try {
      const data = await apiGet(`/api/character/favor?userId=${userId}`);
      if (data.ok) {
        if (Array.isArray(data.liked)) setLikedCharacters(data.liked);
        if (Array.isArray(data.characters)) setLikedCharacterDetails(data.characters);
      }
    } catch (error) {
      console.error('좋아요 캐릭터 로딩 실패:', error);
    }
  };

  useEffect(() => {
    loadLikedCharacters();
  }, [userId]);

  // 하트(좋아요) 토글
  const handleToggleLike = async (characterId: number) => {
    if (!userId) return;
    const liked = likedCharacters.includes(characterId);
    
    try {
      if (!liked) {
        // 좋아요 추가
        const response = await fetch(FAVOR_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, characterId })
        });
        
        if (response.ok) {
          setLikedCharacters(prev => [...prev, characterId]);
          // 현재 캐릭터 정보를 likedCharacterDetails에 추가
          const currentCharacter = characters.find(c => c.id === characterId);
          if (currentCharacter) {
            setLikedCharacterDetails(prev => [currentCharacter, ...prev]);
          }
        }
      } else {
        // 좋아요 취소
        const response = await fetch(FAVOR_API, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, characterId })
        });
        
        if (response.ok) {
          setLikedCharacters(prev => prev.filter(id => id !== characterId));
          setLikedCharacterDetails(prev => prev.filter(c => c.id !== characterId));
        }
      }
    } catch (error) {
      console.error('좋아요 토글 실패:', error);
    }
  };

  // 보관함에서 캐릭터 제거
  const handleRemoveFromArchive = async (characterId: number) => {
    if (!userId) return;
    
    const character = likedCharacterDetails.find(c => c.id === characterId);
    setConfirmTitle('보관함에서 제거');
    setConfirmMsg(`"${character?.name || '이 캐릭터'}"를 보관함에서 제거하시겠습니까?`);
    setConfirmCallback(() => async () => {
      try {
        const response = await fetch(FAVOR_API, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, characterId })
        });
        
        if (response.ok) {
          setLikedCharacters(prev => prev.filter(id => id !== characterId));
          setLikedCharacterDetails(prev => prev.filter(c => c.id !== characterId));
        }
      } catch (error) {
        console.error('보관함에서 제거 실패:', error);
        setAlertTitle('오류');
        setAlertMsg('보관함에서 제거하는 중 오류가 발생했습니다.');
        setAlertOpen(true);
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
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
    fetch(`/api/persona?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.personas)) setPersonas(data.personas);
        else setPersonas([]);
      })
      .catch(() => setPersonas([]));
  }, [userId, showPersonaManager, showPersonaCreator]);

  // 캐릭터 5장 1시간 캐싱 useEffect
  useEffect(() => {
    const CACHE_KEY = 'forYouCharacters';
    const CACHE_TIME_KEY = 'forYouCharactersFetchedAt';
    const now = Date.now();
    const cache = localStorage.getItem(CACHE_KEY);
    const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
    if (cache && cacheTime && now - parseInt(cacheTime, 10) < 60 * 60 * 1000) {
      try {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed)) {
          setCharacters(parsed);
          setLoading(false);
          return;
        }
      } catch (e) {}
    }
    fetch(`/api/character`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.characters)) {
          setCharacters(data.characters);
          // 꼭 필요한 필드만 저장
          const slim = (data.characters as Character[]).map((c) => ({
            id: c.id,
            profileImg: c.profileImg,
            name: c.name,
            age: c.age,
            job: c.job,
            oneLiner: c.oneLiner,
            backgroundImg: c.backgroundImg,
            firstScene: c.firstScene,
            firstMessage: c.firstMessage,
            category: c.category,
            selectedTags: c.selectedTags,
          }));
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(slim));
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
          } catch (e) {
            // 용량 초과 시 캐싱 생략
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_TIME_KEY);
            console.warn('캐릭터 캐싱 실패(용량 초과)', e);
          }
        }
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

  // 터치/마우스 스와이프 지원
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

  // 마우스 드래그(슬라이드) 지원
  let mouseDownX = 0;
  let mouseUpX = 0;
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownX = e.clientX;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  const handleMouseMove = (e: MouseEvent) => {
    mouseUpX = e.clientX;
  };
  const handleMouseUp = (e: MouseEvent) => {
    mouseUpX = e.clientX;
    if (mouseUpX - mouseDownX > 50) handlePrev();
    else if (mouseDownX - mouseUpX > 50) handleNext();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 채팅하기 버튼 클릭 시
  const handleChatClick = () => {
    // 게스트 모드인 경우 바로 채팅으로 이동
    if (isGuestMode()) {
      navigate(`/chat/${characters[index].id}?persona=guest`);
      return;
    }
    
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
      { id: newPersonaName, name: newPersonaName, avatar: newPersonaAvatar || DEFAULT_PROFILE_IMAGE }
    ]);
    setSelectedPersona(newPersonaName);
    setNewPersonaName("");
    setNewPersonaAvatar("");
    setAddingPersona(false);
  };

  // 멀티프로필 생성 완료 (POST)
  const handlePersonaCreate = async () => {
    if (!userId) return;
    if (!creatorName) {
      setAlertTitle('입력 오류');
      setAlertMsg('이름을 입력해주세요');
      setAlertOpen(true);
      return;
    }
    
    setCreatorLoading(true);
    try {
    const payload = {
      userId,
      name: creatorName,
              avatar: creatorProfileImg || DEFAULT_PROFILE_IMAGE,
      gender: creatorGender,
      age: creatorAge,
      job: creatorJob,
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
      setAlertTitle('저장 실패');
      setAlertMsg("프로필 저장 실패: " + data.error);
      setAlertOpen(true);
      }
    } finally {
      setCreatorLoading(false);
    }
  };

  // 멀티프로필 삭제 (DELETE)
  const handleDeletePersona = async (id: string) => {
    if (!userId) return;
    setConfirmTitle('삭제 확인');
    setConfirmMsg('정말로 삭제하시겠습니까?');
    setConfirmCallback(() => async () => {
      await fetch(`${API_BASE_URL}/api/persona/${id}`, { method: "DELETE" });
      setPersonas(prev => prev.filter(p => p.id !== id));
      if (selectedPersona === id && personas.length > 1) {
        setSelectedPersona(personas[0].id);
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  // 채팅 시작
  const handleStartChat = () => {
    setShowPersonaModal(false);
    if (selectedPersona) {
      navigate(`/chat/${characters[index].id}?persona=${selectedPersona}`);
    }
  };

  // 캐릭터 카드 클릭 시 상세로 이동
  const handleCardClick = (id: number) => {
    navigate(`/character/${id}`);
  };

  // User가 생성한 멀티프로필들 (모든 personas가 멀티프로필)
  const multiPersonas = personas;

  // Persona는 순수하게 User가 생성한 멀티프로필만 관리
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
  // Persona(멀티프로필) 관리 - User가 생성한 여러 프로필들을 관리
  const PersonaManager = () => {
    const managedPersonas = personas;
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
                  src={p.avatar || DEFAULT_PROFILE_IMAGE}
              alt={p.name}
                  style={{ width: 54, height: 54, borderRadius: "50%", marginRight: 18, objectFit: "cover", boxShadow: '0 2px 8px #0002' }}
                  onError={handleProfileImageError}
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

  // Persona(멀티프로필) 생성 폼 - User가 채팅에서 연기할 역할 생성
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
    handlePersonaCreate,
    setShowPersonaCreator,
    creatorLoading
  }: any) => (
    <div style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", background: "var(--color-card)", zIndex: 3000, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px 20px" }}>
        <button onClick={() => setShowPersonaCreator(false)} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: "#fff" }}>&larr;</button>
        <span style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>프로필 생성</span>
        <button 
          onClick={handlePersonaCreate} 
          disabled={creatorLoading}
          style={{ 
            background: "none", 
            border: "none", 
            color: creatorLoading ? "#ccc" : "#ff4081", 
            fontWeight: 700, 
            fontSize: 20, 
            cursor: creatorLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          {creatorLoading && (
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid #ff4081',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          {creatorLoading ? '저장 중...' : '완료'}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
        <div style={{ position: "relative", width: 110, height: 110, marginBottom: 16 }}>
          <img
            src={creatorProfileImg || DEFAULT_PROFILE_IMAGE}
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
            +
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
      <div style={{ padding: "0 20px", marginTop: 8, color: "#fff" }}>
        <div style={{ marginBottom: 20, textAlign: "center", color: "#bbb", fontSize: 14 }}>
          채팅에서 사용할 간단한 프로필을 만들어주세요
        </div>
        
        {/* 성별 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>성별</div>
        <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
          {['남성', '여성', '밝히지 않음'].map(g => (
            <label key={g} style={{ display: "flex", alignItems: "center", fontWeight: 500, fontSize: 16, color: "#fff" }}>
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
            if (v.length <= 20) setCreatorName(v);
            else setCreatorName(v.slice(0, 20));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #333", padding: 14, fontSize: 16, marginBottom: 2, background: '#222', color: "#fff" }}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 16 }}>{creatorName.length}/20</div>
        
        {/* 나이 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>나이</div>
        <input
          placeholder="나이를 입력해주세요 (숫자만)"
          type="number"
          min="0"
          max="150"
          value={creatorAge}
          onChange={e => setCreatorAge(e.target.value)}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #333", padding: 14, fontSize: 16, marginBottom: 16, background: '#222', color: "#fff" }}
        />
        
        {/* 직업 */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>직업</div>
        <input
          placeholder="직업을 입력해주세요"
          value={creatorJob}
          onChange={e => {
            const v = e.target.value;
            if (v.length <= 30) setCreatorJob(v);
            else setCreatorJob(v.slice(0, 30));
          }}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #333", padding: 14, fontSize: 16, marginBottom: 2, background: '#222', color: "#fff" }}
        />
        <div style={{ color: '#bbb', fontSize: 13, textAlign: 'right', marginBottom: 40 }}>{creatorJob.length}/30</div>
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
          avatar: updatedProfile.avatar || DEFAULT_PROFILE_IMAGE
        }),
      });
      if (response.ok) {
        setPersonas(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
        setShowProfileEditModal(false);
        setEditProfile(null);
        setAlertTitle('성공');
        setAlertMsg('프로필이 성공적으로 수정되었습니다.');
        setAlertOpen(true);
      } else {
        throw new Error('프로필 수정에 실패했습니다.');
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 수정 중 오류가 발생했습니다.');
      setAlertOpen(true);
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
          avatar: newProfile.avatar
        }),
      });
      if (response.ok) {
        const resData = await response.json();
        console.log('ForYou 페이지 - 생성된 프로필:', resData);
        
        // 모달들 먼저 닫기
        setShowProfileCreateModal(false);
        setShowPersonaManager(false);
        
        // 약간 지연 후 목록 갱신
        setTimeout(async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/persona?userId=${userId}`);
            const data = await res.json();
            if (data.ok) {
                             setPersonas(data.personas || []);
            }
            setAlertTitle('성공');
            setAlertMsg('프로필이 성공적으로 생성되었습니다.');
            setAlertOpen(true);
          } catch (error) {
            console.error('페르소나 목록 갱신 에러:', error);
          }
        }, 100);
      } else {
        throw new Error('프로필 생성에 실패했습니다.');
      }
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 생성 중 오류가 발생했습니다.');
      setAlertOpen(true);
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

  // 남은 초 계산 (버튼 활성/비활성용)
  useEffect(() => {
    function updateRemainSeconds() {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      if (now.getMinutes() !== 0 || now.getSeconds() !== 0 || now.getMilliseconds() !== 0) {
        nextHour.setHours(now.getHours() + 1);
      }
      const remain = nextHour.getTime() - now.getTime();
      const seconds = Math.floor(remain / 1000);
      setRemainSeconds(seconds);
      // 타이머 문자열도 같이 업데이트
      if (seconds <= 0) {
        setTimer("00:00:00");
      } else {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        setTimer(
          `${h.toString().padStart(2, '0')}:` +
          `${m.toString().padStart(2, '0')}:` +
          `${s.toString().padStart(2, '0')}`
        );
      }
    }
    updateRemainSeconds();
    const interval = setInterval(updateRemainSeconds, 1000);
    return () => clearInterval(interval);
  }, []);

  // 캐릭터 새로 받기 함수 (하트 50개 소진)
  const handleRefreshCharacters = async () => {
    // 게스트 모드 체크
    if (isGuestMode()) {
      setShowLoginModal(true);
      return;
    }

    if (!userId) {
      setAlertTitle('로그인 필요');
      setAlertMsg('로그인 후 이용해주세요.');
      setAlertOpen(true);
      return;
    }

    if (hearts < 50) {
      setAlertTitle('하트 부족');
      setAlertMsg('캐릭터 카드를 새로 받으려면 50개의 하트가 필요해요! 💖');
      setAlertOpen(true);
      return;
    }

    setRefreshingCharacters(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/character/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (data.ok) {
        // 새로운 캐릭터들을 리스트에 추가
        const newCharacters = data.characters || [];
        setCharacters(prev => [...newCharacters, ...prev]);
        setIndex(0); // 첫 번째 새 캐릭터로 이동
        
        // 하트 새로고침
        await refreshHearts();
        
        // 캐시 업데이트
        const CACHE_KEY = 'forYouCharacters';
        const CACHE_TIME_KEY = 'forYouCharactersFetchedAt';
        const updatedCharacters = [...newCharacters, ...characters];
        const slim = updatedCharacters.map((c) => ({
          id: c.id,
          profileImg: c.profileImg,
          name: c.name,
          age: c.age,
          job: c.job,
          oneLiner: c.oneLiner,
          backgroundImg: c.backgroundImg,
          firstScene: c.firstScene,
          firstMessage: c.firstMessage,
          category: c.category,
          selectedTags: c.selectedTags,
        }));
        
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(slim));
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_TIME_KEY);
        }

        setAlertTitle('성공');
        setAlertMsg(`${data.message}\n새로운 캐릭터 ${newCharacters.length}장을 받았어요!`);
        setAlertOpen(true);
      } else {
        setAlertTitle('오류');
        setAlertMsg(data.error || '캐릭터 새로 받기에 실패했습니다.');
        setAlertOpen(true);
      }
    } catch (error) {
      console.error('캐릭터 새로 받기 실패:', error);
      setAlertTitle('오류');
      setAlertMsg('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      setAlertOpen(true);
    } finally {
      setRefreshingCharacters(false);
    }
  };

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
      {/* 타이틀과 카드 사이 여백 */}
      <div style={{ height: 24 }} />
      {/* 캐릭터 카드 영역 */}
      {loading ? (
        <div style={{ marginTop: 32 }}><ForYouSkeleton /></div>
      ) : characters.length === 0 ? (
        <div style={{ padding: 20, color: "#888" }}>저장된 캐릭터가 없습니다.</div>
      ) : (
        <div
          style={{
            position: "relative",
            width: 'calc(100vw - 32px)',
            maxWidth: 430,
            aspectRatio: '3/4',
            borderRadius: 24,
            overflow: "hidden",
            background: "#111",
            boxShadow: "0 4px 32px rgba(0,0,0,0.25)",
            margin: "0 auto",
            boxSizing: 'border-box',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {/* 배경 이미지 + 어둡게 */}
          <img
            src={(() => {
              const bg = characters[index].backgroundImg;
              const profile = characters[index].profileImg;
              // backgroundImg가 null, undefined, 빈 문자열이면 profileImg 사용
              if (!bg || bg.trim() === '') {
                return profile || DEFAULT_PROFILE_IMG;
              }
              return bg;
            })()}
            alt="bg"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", filter: "brightness(0.6) blur(1.5px)", zIndex: 1
            }}
            onError={e => { 
              // 첫 번째 실패: backgroundImg -> profileImg로 변경
              if (e.currentTarget.src === characters[index].backgroundImg && characters[index].profileImg) {
                e.currentTarget.onerror = null;
                e.currentTarget.src = characters[index].profileImg;
                return;
              }
              // 두 번째 실패: profileImg -> DEFAULT_PROFILE_IMG로 변경
              if (!e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) { 
                e.currentTarget.onerror = null; 
                e.currentTarget.src = DEFAULT_PROFILE_IMG; 
              }
            }}
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
          {/* 좋아요(하트) 버튼 - 오른쪽 하단으로 이동 */}
          <span
            style={{
              position: "absolute",
              right: 24,
              bottom: 90,
              fontSize: 32,
              color: likedCharacters.includes(characters[index].id) ? "#ff4081" : "#ffb3d1",
              cursor: 'pointer',
              transition: 'color 0.2s',
              zIndex: 3
            }}
            onClick={() => handleToggleLike(characters[index].id)}
            title={likedCharacters.includes(characters[index].id) ? '좋아요 취소' : '좋아요'}
          >{likedCharacters.includes(characters[index].id) ? '♥' : '♡'}</span>
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
          {index > 0 && (
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
          )}
          {/* 오른쪽(다음) 버튼 */}
          {index < characters.length - 1 && (
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
          )}
          {/* 로딩 오버레이 */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
            }}>
              <Spinner />
              <style>{`@keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }`}</style>
            </div>
          )}
        </div>
      )}
      {/* 카드 하단 남은 시간 안내 */}
      <div style={{ width: '100%', textAlign: 'center', marginTop: 32, color: '#bbb', fontWeight: 500, fontSize: 16 }}>
        다음 캐릭터카드가 도착할때까지 남은 시간<br />
        <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>{timer}</span>
      </div>


      {/* 캐릭터 카드 새로 받기 버튼 */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <button
          onClick={handleRefreshCharacters}
          disabled={refreshingCharacters || hearts < 50 || heartsLoading || isGuestMode()}
          style={{
            background: (refreshingCharacters || hearts < 50 || heartsLoading || isGuestMode()) ? '#666' : '#ff4081', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 18, 
            padding: '14px 40px', 
            fontWeight: 700, 
            fontSize: 18, 
            cursor: (refreshingCharacters || hearts < 50 || heartsLoading || isGuestMode()) ? 'not-allowed' : 'pointer', 
            boxShadow: '0 2px 8px #ff408133', 
            transition: 'all 0.2s',
            minWidth: '200px',
            position: 'relative'
          }}
        >
          {refreshingCharacters ? (
            <>
              <span style={{ marginRight: 8 }}>🔄</span>
              새로 받는 중...
            </>
          ) : isGuestMode() ? (
            <>
              <span style={{ marginRight: 8 }}>🔒</span>
              로그인 후 이용 가능
            </>
          ) : hearts < 50 ? (
            <>
              <span style={{ marginRight: 8 }}>💖</span>
              하트 부족 ({hearts}/50)
            </>
          ) : (
            "캐릭터 새로 받기(하트 50)"
          )}
        </button>
      </div>
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
                    src={p.avatar || DEFAULT_PROFILE_IMAGE}
                  alt={p.name}
                    style={{ width: 56, height: 56, borderRadius: "50%", marginRight: 18, objectFit: "cover", boxShadow: '0 2px 8px #0002' }}
                    onError={handleProfileImageError}
                />
                  <span style={{ fontWeight: 700, fontSize: 20, color: "#fff", letterSpacing: 0.5 }}>{p.name}</span>
                  {selectedPersona === p.id && <span style={{ marginLeft: "auto", color: "#fff", fontSize: 32, fontWeight: 900 }}>✔️</span>}
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
          handlePersonaCreate={handlePersonaCreate}
          setShowPersonaCreator={setShowPersonaCreator}
          creatorLoading={creatorLoading}
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
            avatar: editProfile.avatar || DEFAULT_PROFILE_IMAGE
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
            avatar: DEFAULT_PROFILE_IMAGE
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
            {likedCharacterDetails.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 16, marginTop: 40 }}>좋아요한 캐릭터가 없습니다.</div>
            ) : (
              <div style={{ width: '100%' }}>
                {likedCharacterDetails.map(c => (
                  <div
                    key={c.id}
                    style={{ display: 'flex', alignItems: 'center', background: '#232124', borderRadius: 14, padding: '14px 12px', marginBottom: 14, boxShadow: '0 2px 8px #0002', position: 'relative' }}
                  >
                    <img 
                      src={c.profileImg || DEFAULT_PROFILE_IMG} 
                      alt={c.name} 
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginRight: 14, cursor: 'pointer' }}
                      onClick={() => { setArchiveDetailCharacter(c); setShowArchiveDetailModal(true); }}
                      onError={e => { 
                        if (!e.currentTarget.src.endsWith(DEFAULT_PROFILE_IMG)) { 
                          e.currentTarget.onerror = null; 
                          e.currentTarget.src = DEFAULT_PROFILE_IMG; 
                        } 
                      }}
                    />
                    <div 
                      style={{ flex: 1, cursor: 'pointer' }}
                      onClick={() => { setArchiveDetailCharacter(c); setShowArchiveDetailModal(true); }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>{c.name}</div>
                      <div style={{ color: '#bbb', fontSize: 14 }}>{c.age ? `${c.age}살` : '-'} | {c.job || '-'}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromArchive(c.id);
                      }}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'rgba(255, 64, 129, 0.2)',
                        border: 'none',
                        color: '#ff4081',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(255, 64, 129, 0.3)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = 'rgba(255, 64, 129, 0.2)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title="보관함에서 제거"
                    >
                      ✕
                    </button>
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
      <LoginPromptModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        message="캐릭터 새로 받기는 로그인 후 이용할 수 있습니다."
      />
      <CustomAlert open={alertOpen} title={alertTitle} message={alertMsg} onConfirm={() => setAlertOpen(false)} />
      
      {/* Confirm 다이얼로그 */}
      <CustomAlert 
        open={confirmOpen} 
        title={confirmTitle} 
        message={confirmMsg} 
        onConfirm={() => confirmCallback && confirmCallback()} 
        onCancel={() => setConfirmOpen(false)}
        confirmText="확인"
        cancelText="취소"
      />
      
      <BottomNav />
    </div>
  );
} 