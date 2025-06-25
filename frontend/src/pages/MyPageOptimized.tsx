import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiSettings } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import CharacterEditModal from "../components/CharacterEditModal";
import ProfileDetailModal from "../components/ProfileDetailModal";
import { signOutUser } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import { useBasicProfile } from "../hooks/useBasicProfile";
import { usePersonas } from "../hooks/usePersonas";
import { useCharactersInfinite } from "../hooks/useCharactersInfinite";
import { createApiTimer, getPerformanceStats, resetPerformanceStats } from "../lib/api";
import CustomAlert from '../components/CustomAlert';
import OptimizedImage from '../components/OptimizedImage';
import { DEFAULT_PROFILE_IMAGE } from '../utils/constants';

interface Persona {
  id: string;
  name: string;
  avatar: string;
  gender?: string;
  age?: string;
  job?: string;
  info?: string;
  habit?: string;
}

interface Character {
  id: number;
  profileImg?: string | null;
  name?: string;
  tags?: string[] | string;
  selectedTags?: string[];
  category?: string;
  gender?: string;
  scope?: string;
  age?: string | number;
  job?: string;
  oneLiner?: string;
  background?: string;
  personality?: string;
  habit?: string;
  like?: string;
  dislike?: string;
  extraInfos?: string[];
  firstScene?: string;
  firstMessage?: string;
  backgroundImg?: string | null;
}

// 메모이제이션된 HeartButton 컴포넌트
const HeartButton = memo(({ count, onClick }: { count: number; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18, color: "#ff4081",
      background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: 0
    }}
  >
    <span style={{ marginRight: 4 }}>보유 하트</span>
    {count} <span role="img" aria-label="하트" style={{ marginLeft: 4, fontSize: 20 }}>❤️</span>
  </button>
));

// 성능 통계 컴포넌트
const PerformanceStats = memo(() => {
  const [stats, setStats] = useState(getPerformanceStats());
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getPerformanceStats());
    }, 1000); // 1초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development' && !showStats) return null;

  return (
    <div style={{ 
      position: 'fixed',
      bottom: 100,
      right: 20,
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: 12,
      borderRadius: 8,
      fontSize: 12,
      zIndex: 1000,
      maxWidth: 200
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>📊 API 성능</span>
        <button
          onClick={() => setShowStats(!showStats)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          {showStats ? '−' : '+'}
        </button>
      </div>
      {showStats && (
        <>
          <div>총 요청: {stats.totalRequests}회</div>
          <div>평균 응답: {stats.avgDuration}ms</div>
          <div>성공률: {stats.totalRequests > 0 ? Math.round((stats.successCount / stats.totalRequests) * 100) : 0}%</div>
          <div>가장 빠름: {stats.fastestRequest.duration === Infinity ? '-' : `${stats.fastestRequest.duration}ms`}</div>
          <div>가장 느림: {stats.slowestRequest.duration}ms</div>
          <button
            onClick={resetPerformanceStats}
            style={{
              background: '#ff4081',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              cursor: 'pointer',
              marginTop: 8,
              width: '100%'
            }}
          >
            리셋
          </button>
        </>
      )}
    </div>
  );
});

// 무한 스크롤 IntersectionObserver 훅
const useInfiniteScroll = (callback: () => void, hasMore: boolean, loading: boolean) => {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          callback();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [callback, hasMore, loading]);

  return observerRef;
};

// 섹션별 컴포넌트
const PersonasSection = memo(({ userId }: { userId: string }) => {
  const {
    personas,
    loading,
    error,
    hasLoaded,
    loadPersonas,
    createPersona,
    updatePersona,
    deletePersona
  } = usePersonas(userId);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');

  // Lazy loading - 펼쳤을 때만 로드 (응답시간 측정 추가)
  useEffect(() => {
    if (isExpanded && !hasLoaded && !loading) {
      const timer = createApiTimer('페르소나 목록 로딩');
      timer.start();
      
      loadPersonas().then(() => {
        timer.end('페르소나 목록 로딩 완료');
      }).catch((error) => {
        timer.end(null, error);
      });
    }
  }, [isExpanded, hasLoaded, loading, loadPersonas]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleEdit = (persona: Persona) => {
    setSelectedPersona(persona);
    setShowEditModal(true);
  };

  const handleSave = async (updatedPersona: Persona) => {
    const timer = createApiTimer('페르소나 수정');
    try {
      await timer.measure(async () => {
        return await updatePersona(updatedPersona.id, updatedPersona);
      });
      
      setShowEditModal(false);
      setAlertTitle('성공');
      setAlertMsg('프로필이 성공적으로 수정되었습니다.');
      setAlertOpen(true);
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 수정에 실패했습니다.');
      setAlertOpen(true);
    }
  };

  const handleCreate = async (newPersona: Persona) => {
    const timer = createApiTimer('페르소나 생성');
    try {
      await timer.measure(async () => {
        return await createPersona(newPersona);
      });
      
      setShowCreateModal(false);
      setAlertTitle('성공');
      setAlertMsg('프로필이 성공적으로 생성되었습니다.');
      setAlertOpen(true);
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 생성에 실패했습니다.');
      setAlertOpen(true);
    }
  };

  const handleDelete = async (personaId: string) => {
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      const timer = createApiTimer('페르소나 삭제');
      try {
        await timer.measure(async () => {
          return await deletePersona(personaId);
        });
        
        setAlertTitle('성공');
        setAlertMsg('프로필이 삭제되었습니다.');
        setAlertOpen(true);
      } catch (error) {
        setAlertTitle('오류');
        setAlertMsg('프로필 삭제에 실패했습니다.');
        setAlertOpen(true);
      }
    }
  };

  return (
    <div style={{ marginTop: 24, padding: "0 20px" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          onClick={handleExpand}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          멀티프로필 {hasLoaded && `(${personas.length})`}
          <span style={{ marginLeft: 8, fontSize: 14 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
        
        {isExpanded && (
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={personas.length >= 10}
            style={{
              background: 'none',
              border: 'none',
              color: personas.length >= 10 ? '#888' : '#bbb',
              fontWeight: 600,
              fontSize: 14,
              cursor: personas.length >= 10 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title={personas.length >= 10 ? '최대 10개까지 생성할 수 있습니다.' : ''}
          >
            <span style={{ fontSize: 18, marginRight: 4 }}>+</span> 
            멀티프로필 만들기 ({personas.length}/10)
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {loading ? (
            <div style={{ color: '#888', fontSize: 14, padding: 16 }}>
              로딩 중...
            </div>
          ) : error ? (
            <div style={{ color: '#ff4081', fontSize: 14, padding: 16 }}>
              {error}
            </div>
          ) : personas.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14, padding: 16 }}>
              아직 생성한 멀티프로필이 없습니다.
            </div>
          ) : (
            personas.map((persona) => (
              <div key={persona.id} style={{ 
                display: "flex", 
                alignItems: "center", 
                background: "var(--color-card-alt)", 
                borderRadius: 12, 
                padding: 12, 
                marginBottom: 10 
              }}>
                <OptimizedImage
                  src={persona.avatar || DEFAULT_PROFILE_IMAGE}
                  alt={persona.name}
                  width={40}
                  height={40}
                  style={{ 
                    borderRadius: "50%", 
                    marginRight: 12, 
                    objectFit: "cover", 
                    background: "#222", 
                    border: "1.5px solid #333", 
                    cursor: 'pointer' 
                  }}
                  onClick={() => { 
                    setSelectedPersona(persona); 
                    setShowDetailModal(true); 
                  }}
                  priority={false}
                />
                <span style={{ fontWeight: 600, fontSize: 16 }}>{persona.name}</span>
                <button
                  style={{ 
                    marginLeft: "auto", 
                    color: "#4CAF50", 
                    background: "none", 
                    border: "none", 
                    fontSize: 16, 
                    cursor: "pointer" 
                  }}
                  onClick={() => handleEdit(persona)}
                >
                  수정
                </button>
                <button
                  style={{ 
                    color: "#ff4081", 
                    background: "none", 
                    border: "none", 
                    fontSize: 16, 
                    cursor: "pointer", 
                    marginLeft: 8 
                  }}
                  onClick={() => handleDelete(persona.id)}
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </>
      )}

      {/* 모달들 */}
      {showCreateModal && (
        <ProfileEditModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
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
          onSave={handleCreate}
        />
      )}

      {showEditModal && selectedPersona && (
        <ProfileEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          profileData={{
            id: selectedPersona.id,
            name: selectedPersona.name,
            gender: selectedPersona.gender || '',
            age: parseInt(selectedPersona.age || '0') || 0,
            job: selectedPersona.job || '',
            info: selectedPersona.info || '',
            habit: selectedPersona.habit || '',
            avatar: selectedPersona.avatar
          }}
          onSave={handleSave}
        />
      )}

      {showDetailModal && selectedPersona && (
        <ProfileDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          profile={selectedPersona}
        />
      )}

      <CustomAlert
        open={alertOpen}
        title={alertTitle}
        message={alertMsg}
        onConfirm={() => setAlertOpen(false)}
      />
    </div>
  );
});

// 캐릭터 섹션 컴포넌트
const CharactersSection = memo(({ userId }: { userId: string }) => {
  const {
    characters,
    loading,
    error,
    hasLoaded,
    hasMore,
    total,
    loadCharacters,
    loadMore,
    deleteCharacter,
    isLoadingMore
  } = useCharactersInfinite(userId);

  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');

  // 무한 스크롤 설정
  const observerRef = useInfiniteScroll(loadMore, hasMore, isLoadingMore);

  // Lazy loading - 펼쳤을 때만 로드 (응답시간 측정 추가)
  useEffect(() => {
    if (isExpanded && !hasLoaded && !loading) {
      const timer = createApiTimer('캐릭터 목록 초기 로딩');
      timer.start();
      
      loadCharacters().then(() => {
        timer.end('캐릭터 목록 로딩 완료');
      }).catch((error) => {
        timer.end(null, error);
      });
    }
  }, [isExpanded, hasLoaded, loading, loadCharacters]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async (characterId: number) => {
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      const timer = createApiTimer('캐릭터 삭제');
      try {
        await timer.measure(async () => {
          return await deleteCharacter(characterId);
        });
        
        setAlertTitle('성공');
        setAlertMsg('캐릭터가 삭제되었습니다.');
        setAlertOpen(true);
      } catch (error) {
        setAlertTitle('오류');
        setAlertMsg('캐릭터 삭제에 실패했습니다.');
        setAlertOpen(true);
      }
    }
  };

  return (
    <div style={{ marginTop: 24, padding: "0 20px" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          onClick={handleExpand}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          내 캐릭터 {hasLoaded && total > 0 && `(${total}개)`}
          <span style={{ marginLeft: 8, fontSize: 14 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
      </div>

      {isExpanded && (
        <>
          {loading ? (
            <div style={{ color: '#888', fontSize: 14, padding: 16 }}>
              로딩 중...
            </div>
          ) : error ? (
            <div style={{ color: '#ff4081', fontSize: 14, padding: 16 }}>
              {error}
            </div>
          ) : characters.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14, padding: 16 }}>
              아직 만든 캐릭터가 없습니다.
            </div>
          ) : (
            <>
              {characters.map((character) => (
                <div key={character.id} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  background: "var(--color-card)", 
                  borderRadius: 12, 
                  padding: 12, 
                  marginBottom: 12 
                }}>
                  <OptimizedImage
                    src={character.profileImg || DEFAULT_PROFILE_IMAGE}
                    alt={character.name || '캐릭터'}
                    width={48}
                    height={48}
                    style={{ 
                      borderRadius: "50%", 
                      marginRight: 12, 
                      objectFit: "cover", 
                      cursor: "pointer" 
                    }}
                    onClick={() => navigate(`/character/${character.id}`)}
                    priority={false}
                  />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{character.name}</span>
                  <button 
                    style={{ 
                      marginLeft: "auto", 
                      marginRight: 12, 
                      color: "#4CAF50", 
                      background: "none", 
                      border: "none", 
                      fontSize: 16, 
                      cursor: "pointer" 
                    }}
                    onClick={() => { 
                      setSelectedCharacter(character); 
                      setShowEditModal(true); 
                    }}
                  >
                    수정
                  </button>
                  <button 
                    style={{ 
                      color: "#ff4081", 
                      background: "none", 
                      border: "none", 
                      fontSize: 16, 
                      cursor: "pointer" 
                    }}
                    onClick={() => handleDelete(character.id)}
                  >
                    삭제
                  </button>
                </div>
              ))}

              {/* 무한 스크롤 감지 영역 */}
              {hasMore && (
                <div ref={observerRef} style={{ height: 20, margin: '16px 0' }}>
                  {isLoadingMore && (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#888', 
                      fontSize: 14 
                    }}>
                      더 많은 캐릭터 로딩 중...
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 캐릭터 수정 모달 - 추후 구현 */}
      {showEditModal && selectedCharacter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 20,
            padding: 32,
            width: '90%',
            maxWidth: 400,
            textAlign: 'center'
          }}>
            <div style={{ color: '#fff', marginBottom: 16 }}>
              캐릭터 수정 기능은 곧 추가됩니다.
            </div>
            <button
              onClick={() => setShowEditModal(false)}
              style={{
                background: '#ff4081',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <CustomAlert
        open={alertOpen}
        title={alertTitle}
        message={alertMsg}
        onConfirm={() => setAlertOpen(false)}
      />
    </div>
  );
});

export default function MyPageOptimized() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hearts, loading: heartsLoading } = useHearts(user?.uid || null);
  const { profile, loading: profileLoading, error: profileError, refetch } = useBasicProfile(user?.uid || null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserProfileEditModal, setShowUserProfileEditModal] = useState(false);
  const [showProfileDetailModal, setShowProfileDetailModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; avatar: string }>({ 
    name: user?.displayName || "사용자", 
    avatar: DEFAULT_PROFILE_IMAGE 
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.uid || "";

  // 페이지 로딩 성능 측정
  useEffect(() => {
    const timer = createApiTimer('마이페이지 전체 로딩');
    timer.start();
    
    if (!authLoading && !profileLoading) {
      timer.end(profile ? '마이페이지 로딩 성공' : '마이페이지 로딩 완료');
    }
  }, [authLoading, profileLoading, profile]);

  // 메모이제이션된 콜백들
  const handleHeartClick = useCallback(() => {
    navigate('/heart-shop');
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      setUserProfile({
        name: profile.name || user?.displayName || "사용자",
        avatar: DEFAULT_PROFILE_IMAGE // 실제로는 profile.avatar 사용
      });
    }
  }, [profile, user?.displayName]);

  // 로그아웃 처리
  const handleLogout = async () => {
    const timer = createApiTimer('로그아웃');
    try {
      await timer.measure(async () => {
        await signOutUser();
        navigate('/login');
      });
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleUserProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleUserProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newProfileImg = ev.target?.result as string;
        setUserProfile(prev => ({ ...prev, avatar: newProfileImg }));
        // localStorage에 저장
        const userProfileToSave = {
          name: userProfile.name,
          avatar: newProfileImg
        };
        localStorage.setItem('userProfile', JSON.stringify(userProfileToSave));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserNameSave = () => {
    // localStorage에 저장
    const userProfileToSave = {
      name: userProfile.name,
      avatar: userProfile.avatar
    };
    localStorage.setItem('userProfile', JSON.stringify(userProfileToSave));
    setShowUserProfileEditModal(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div style={{ 
        background: "var(--color-bg)", 
        minHeight: "100vh", 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: '#fff',
        fontSize: 18,
        fontWeight: 600
      }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  if (profileError) {
    return (
      <div style={{ 
        background: "var(--color-bg)", 
        minHeight: "100vh", 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: '#ff4081',
        fontSize: 18,
        fontWeight: 600,
        flexDirection: 'column',
        gap: 16
      }}>
        <div>사용자 정보를 불러올 수 없습니다</div>
        <button 
          onClick={() => refetch()}
          style={{
            background: '#ff4081',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* 성능 통계 표시 (개발 환경에서만) */}
      <PerformanceStats />

      {/* 상단 기본 프로필 카드 */}
      <div style={{
        background: "var(--color-card)",
        borderRadius: 20,
        margin: "24px 20px 0 20px",
        padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <OptimizedImage
            src={userProfile.avatar || DEFAULT_PROFILE_IMAGE}
            alt="프로필"
            width={60}
            height={60}
            style={{ 
              borderRadius: "50%", 
              marginRight: 16, 
              objectFit: "cover", 
              background: "#222", 
              border: "2px solid #333", 
              cursor: "pointer" 
            }}
            onClick={() => setShowProfileDetailModal(true)}
            priority={true}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{userProfile.name}</div>
            <HeartButton count={heartsLoading ? 0 : hearts} onClick={handleHeartClick} />
          </div>
        </div>
        <div style={{ textAlign: "right", display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setShowUserProfileEditModal(true)}
            style={{ 
              background: '#fff', 
              border: 'none', 
              color: '#222', 
              fontWeight: 600, 
              fontSize: 15, 
              cursor: 'pointer', 
              borderRadius: 16, 
              padding: '8px 18px', 
              marginBottom: 8 
            }}
          >
            내 프로필
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#888', 
              fontSize: 24, 
              cursor: 'pointer', 
              padding: 0 
            }}
            aria-label="설정"
            title="설정"
          >
            {typeof FiSettings === 'function' ? <FiSettings /> : null}
          </button>
        </div>
      </div>

      {/* 페르소나 섹션 (Lazy Loading + 응답시간 측정) */}
      <PersonasSection userId={userId} />

      {/* 캐릭터 섹션 (Infinite Scroll + 응답시간 측정) */}
      <CharactersSection userId={userId} />

      <BottomNav />

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2000
        }}>
          <div style={{ 
            background: 'var(--color-card)', 
            borderRadius: 20, 
            padding: 32, 
            width: '90%', 
            maxWidth: 300, 
            position: 'relative', 
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)' 
          }}>
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{ 
                position: 'absolute', 
                right: 16, 
                top: 16, 
                background: 'none', 
                border: 'none', 
                fontSize: 24, 
                cursor: 'pointer', 
                color: '#fff' 
              }}
              aria-label="닫기"
            >×</button>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 22, 
              color: '#fff', 
              marginBottom: 32, 
              textAlign: 'center' 
            }}>설정</div>
            
            <button
              onClick={() => {
                setShowSettingsModal(false);
                setShowLogoutConfirm(true);
              }}
              style={{
                width: '100%',
                background: '#ff4081',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '16px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                marginBottom: 16
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      {/* 로그아웃 확인 모달 */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2000
        }}>
          <div style={{ 
            background: 'var(--color-card)', 
            borderRadius: 20, 
            padding: 32, 
            width: '90%', 
            maxWidth: 400, 
            textAlign: 'center', 
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)' 
          }}>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 20, 
              color: '#fff', 
              marginBottom: 24 
            }}>
              정말 로그아웃 하시겠습니까?
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  background: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                style={{
                  background: '#ff4081',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 유저 프로필 수정 모달 */}
      {showUserProfileEditModal && (
        <div style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2000
        }}>
          <div style={{ 
            background: 'var(--color-card)', 
            borderRadius: 20, 
            padding: 32, 
            width: '90%', 
            maxWidth: 400, 
            position: 'relative', 
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)' 
          }}>
            <button
              onClick={() => setShowUserProfileEditModal(false)}
              style={{ 
                position: 'absolute', 
                right: 16, 
                top: 16, 
                background: 'none', 
                border: 'none', 
                fontSize: 24, 
                cursor: 'pointer', 
                color: '#fff' 
              }}
              aria-label="닫기"
            >×</button>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 22, 
              color: '#fff', 
              marginBottom: 32, 
              textAlign: 'center' 
            }}>프로필 수정</div>
            
            {/* 프로필 이미지 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                <OptimizedImage
                  src={userProfile.avatar || DEFAULT_PROFILE_IMAGE}
                  alt="프로필"
                  width={100}
                  height={100}
                  style={{ 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: '3px solid #fff' 
                  }}
                  priority={true}
                />
                <button
                  onClick={handleUserProfileImageClick}
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    background: '#ff4081',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  aria-label="프로필 사진 변경"
                >
                  +
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUserProfileImageChange}
                />
              </div>
            </div>

            {/* 이름 입력 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ 
                display: 'block', 
                fontWeight: 600, 
                fontSize: 16, 
                color: '#fff', 
                marginBottom: 8 
              }}>이름</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                style={{
                  width: '100%',
                  background: 'var(--color-input)',
                  border: '1px solid #444',
                  borderRadius: 12,
                  padding: '12px 16px',
                  fontSize: 16,
                  color: '#fff'
                }}
              />
            </div>

            <button
              onClick={handleUserNameSave}
              style={{
                width: '100%',
                background: '#ff4081',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '16px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {showProfileDetailModal && (
        <ProfileDetailModal
          isOpen={showProfileDetailModal}
          onClose={() => setShowProfileDetailModal(false)}
          profile={{ 
            id: 'user', 
            name: userProfile.name, 
            avatar: userProfile.avatar 
          }}
        />
      )}
    </div>
  );
} 