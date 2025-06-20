import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiHeart, FiPlus, FiEdit3, FiX } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import { API_BASE_URL } from '../lib/openai';
import CustomAlert from '../components/CustomAlert';
import LoginPromptModal from '../components/LoginPromptModal';
import { isGuestMode, GUEST_LIMITS, getGuestLimitMessage } from '../utils/guestMode';

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
  age: number;
  gender: string;
  job: string;
}

// 모든 초기 데이터를 한 번에 가져오는 함수
async function fetchAllInitialData(userId: string | null) {
  const promises = [];
  
  // 기본 캐릭터 목록 (항상 필요)
  promises.push(
    fetch(`${API_BASE_URL}/api/character`)
      .then(res => res.json())
      .catch(error => {
        console.error('캐릭터 목록 로딩 실패:', error);
        return { ok: false, characters: [] };
      })
  );
  
  if (userId) {
    // 로그인한 사용자의 데이터들 병렬 로딩
    promises.push(
      // 페르소나 목록
      fetch(`${API_BASE_URL}/api/persona?userId=${userId}`)
        .then(res => res.json())
        .catch(error => {
          console.error('페르소나 로딩 실패:', error);
          return { ok: false, personas: [] };
        }),
      
      // 좋아요 목록
      fetch(`${API_BASE_URL}/api/character/favor?userId=${userId}`)
        .then(res => res.json())
        .catch(error => {
          console.error('좋아요 목록 로딩 실패:', error);
          return { ok: false, liked: [], characters: [] };
        }),
      
      // 사용자 생성 캐릭터
      fetch(`${API_BASE_URL}/api/character?userId=${userId}`)
        .then(res => res.json())
        .catch(error => {
          console.error('사용자 캐릭터 로딩 실패:', error);
          return { ok: false, characters: [] };
        })
    );
  } else {
    // 비로그인 사용자용 빈 데이터
    promises.push(
      Promise.resolve({ ok: true, personas: [] }),
      Promise.resolve({ ok: true, liked: [], characters: [] }),
      Promise.resolve({ ok: true, characters: [] })
    );
  }
  
  try {
    const [
      charactersData,
      personasData,
      favorsData,
      userCharactersData
    ] = await Promise.all(promises);
    
    return {
      characters: charactersData?.characters || [],
      personas: personasData?.personas || [],
      likedCharacters: favorsData?.liked || [],
      likedCharacterDetails: favorsData?.characters || [],
      userCharacters: userCharactersData?.characters || []
    };
  } catch (error) {
    console.error('초기 데이터 로딩 실패:', error);
    return {
      characters: [],
      personas: [],
      likedCharacters: [],
      likedCharacterDetails: [],
      userCharacters: []
    };
  }
}

export default function ForYouPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || null;

  // 상태 관리
  const [characters, setCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [likedCharacters, setLikedCharacters] = useState<number[]>([]);
  const [likedCharacterDetails, setLikedCharacterDetails] = useState<Character[]>([]);
  
  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  const [refreshingCharacters, setRefreshingCharacters] = useState(false);
  
  // UI 상태
  const [activeTab, setActiveTab] = useState('explore');
  const [archiveDetailCharacter, setArchiveDetailCharacter] = useState<Character | null>(null);
  const [showArchiveDetailModal, setShowArchiveDetailModal] = useState(false);
  const [timer, setTimer] = useState<string>("01:00:00");
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

  // 하트 에러 처리
  useEffect(() => {
    if (heartsError) {
      setAlertTitle('하트 오류');
      setAlertMsg(heartsError);
      setAlertOpen(true);
    }
  }, [heartsError]);

  // 초기 데이터 로딩 (병렬 처리로 최적화)
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      setLoading(true);
      
      try {
        const data = await fetchAllInitialData(userId);
        
        if (isMounted) {
          setCharacters(data.characters);
          setPersonas(data.personas);
          setUserCharacters(data.userCharacters);
          setLikedCharacters(data.likedCharacters);
          setLikedCharacterDetails(data.likedCharacterDetails);
          
          // 첫 번째 페르소나 자동 선택
          if (data.personas.length > 0) {
            setSelectedPersona(data.personas[0]);
          }
        }
      } catch (error) {
        console.error('초기 데이터 로딩 실패:', error);
        if (isMounted) {
          setAlertTitle('로딩 오류');
          setAlertMsg('데이터를 불러오는 중 오류가 발생했습니다.');
          setAlertOpen(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // 좋아요한 캐릭터 로딩
  const loadLikedCharacters = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/character/favor?userId=${userId}`);
      const data = await response.json();
      if (data.ok) {
        setLikedCharacters(data.liked || []);
        setLikedCharacterDetails(data.characters || []);
      }
    } catch (error) {
      console.error('좋아요 목록 로딩 실패:', error);
    }
  };

  // 좋아요한 캐릭터 목록 로딩
  useEffect(() => {
    if (userId) {
      loadLikedCharacters();
    }
  }, [userId]);

  // 채팅 버튼 클릭 핸들러 (현재 사용하지 않음)
  const handleChatClick = (character: Character) => {
    console.log('채팅 클릭:', character);
  };

  // 페르소나 추가 핸들러 (현재 사용하지 않음)
  const handleAddPersona = () => {
    console.log('페르소나 추가');
  };

  // 로딩 중일 때 화면
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'var(--color-bg)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#fff',
        fontSize: '18px',
        fontWeight: '600'
      }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: '80px' }}>
      {/* 헤더 */}
      <div style={{
        padding: '20px',
        background: 'var(--color-card)',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '24px', fontWeight: '700' }}>
            For You
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#999', fontSize: '14px' }}>
            당신을 위한 추천 캐릭터
          </p>
        </div>
        <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>
          💖 {heartsLoading ? '...' : hearts.toLocaleString()}
        </div>
      </div>

      {/* 캐릭터 목록 */}
      <div style={{ padding: '20px' }}>
        {characters.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#999',
            fontSize: '16px',
            marginTop: '40px'
          }}>
            캐릭터를 불러오는 중...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '16px'
          }}>
            {characters.map((character) => (
              <div
                key={character.id}
                style={{
                  background: 'var(--color-card)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid #333',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onClick={() => navigate(`/character/${character.id}`)}
              >
                <img
                  src={character.profileImg || '/imgdefault.jpg'}
                  alt={character.name}
                  style={{
                    width: '100%',
                    height: '160px',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.currentTarget.src = '/imgdefault.jpg';
                  }}
                />
                <div style={{ padding: '12px' }}>
                  <h3 style={{ 
                    margin: '0 0 4px 0', 
                    color: '#fff', 
                    fontSize: '16px', 
                    fontWeight: '600',
                    lineHeight: '1.2'
                  }}>
                    {character.name}
                  </h3>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    color: '#999', 
                    fontSize: '12px' 
                  }}>
                    {character.age}세 • {character.job}
                  </p>
                  <p style={{ 
                    margin: 0, 
                    color: '#ccc', 
                    fontSize: '12px',
                    lineHeight: '1.3',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {character.oneLiner}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사용하지 않는 변수들 - 임시로 로그 출력 */}
      {(() => {
        const localUserName = user?.displayName || '게스트';
        console.log('현재 사용자:', localUserName);
        return null;
      })()}

      {/* 바텀 네비게이션 */}
      <BottomNav />

      {/* 알림 모달 */}
      <CustomAlert
        open={alertOpen}
        title={alertTitle}
        message={alertMsg}
        onConfirm={() => setAlertOpen(false)}
      />

      {/* 로그인 유도 모달 */}
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="로그인하여 더 많은 기능을 이용해보세요!"
      />
    </div>
  );
} 