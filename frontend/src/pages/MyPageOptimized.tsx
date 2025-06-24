import React, { useState, useRef, useMemo, useCallback, memo } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiSettings } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import CharacterEditModal from "../components/CharacterEditModal";
import ProfileDetailModal from "../components/ProfileDetailModal";
import OptimizedImage from "../components/OptimizedImage";
import Skeleton from "../components/Skeleton";
import { signOutUser } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import { useMyInfo, clearMyInfoCache } from "../hooks/useMyInfo";
import { apiPost, apiPut, apiDelete } from '../lib/api';
import CustomAlert from '../components/CustomAlert';
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';

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

interface Persona {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  gender?: string;
  age?: string;
  job?: string;
  info?: string;
  habit?: string;
}

// 메모이제이션된 하트 버튼 컴포넌트
const HeartButton = memo(({ count, onClick }: { count: number; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', 
      alignItems: 'center', 
      fontWeight: 700, 
      fontSize: 18, 
      color: "#ff4081",
      background: 'none', 
      border: 'none', 
      cursor: 'pointer', 
      padding: 0, 
      margin: 0
    }}
  >
    <span style={{ marginRight: 4 }}>보유 하트</span>
    {count} <span role="img" aria-label="하트" style={{ marginLeft: 4, fontSize: 20 }}>❤️</span>
  </button>
));

// 메모이제이션된 프로필 카드 컴포넌트
const ProfileCard = memo(({ 
  profile, 
  onEdit, 
  onDelete, 
  onClick 
}: { 
  profile: Persona; 
  onEdit: (profile: Persona) => void;
  onDelete: (id: string) => void;
  onClick: (profile: Persona) => void;
}) => {
  const handleEdit = useCallback(() => onEdit(profile), [profile, onEdit]);
  const handleDelete = useCallback(async () => {
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      await onDelete(profile.id);
    }
  }, [profile.id, onDelete]);
  const handleClick = useCallback(() => onClick(profile), [profile, onClick]);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      background: "var(--color-card-alt)", 
      borderRadius: 12, 
      padding: 12, 
      marginBottom: 10 
    }}>
      <OptimizedImage
        src={profile.avatar || DEFAULT_PROFILE_IMAGE}
        alt={profile.name}
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
        onClick={handleClick}
        priority={false}
      />
      <span style={{ fontWeight: 600, fontSize: 16 }}>{profile.name}</span>
      <button
        style={{ 
          marginLeft: "auto", 
          color: "#4CAF50", 
          background: "none", 
          border: "none", 
          fontSize: 16, 
          cursor: "pointer" 
        }}
        onClick={handleEdit}
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
        onClick={handleDelete}
      >
        삭제
      </button>
    </div>
  );
});

// 메모이제이션된 캐릭터 카드 컴포넌트
const CharacterCard = memo(({ 
  character, 
  onEdit, 
  onDelete, 
  onNavigate 
}: { 
  character: Character; 
  onEdit: (character: Character) => void;
  onDelete: (id: number) => void;
  onNavigate: (id: number) => void;
}) => {
  const handleEdit = useCallback(() => onEdit(character), [character, onEdit]);
  const handleDelete = useCallback(async () => {
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      await onDelete(character.id);
    }
  }, [character.id, onDelete]);
  const handleNavigate = useCallback(() => onNavigate(character.id), [character.id, onNavigate]);

  return (
    <div style={{ 
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
        onClick={handleNavigate}
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
        onClick={handleEdit}
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
        onClick={handleDelete}
      >
        삭제
      </button>
    </div>
  );
});

// 스켈레톤 로더 컴포넌트
const MyPageSkeleton = memo(() => (
  <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
    {/* 프로필 카드 스켈레톤 */}
    <div style={{
      background: "var(--color-card)",
      borderRadius: 20,
      margin: "24px 20px 0 20px",
      padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Skeleton width={60} height={60} borderRadius="50%" />
          <div style={{ marginLeft: 16 }}>
            <Skeleton width={120} height={20} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={16} />
          </div>
        </div>
        <Skeleton width={80} height={36} borderRadius={16} />
      </div>
    </div>

    {/* 멀티프로필 섹션 스켈레톤 */}
    <div style={{ marginTop: 24, padding: "0 20px" }}>
      <Skeleton width={120} height={20} style={{ marginBottom: 16 }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ 
          display: "flex", 
          alignItems: "center", 
          background: "var(--color-card-alt)", 
          borderRadius: 12, 
          padding: 12, 
          marginBottom: 10 
        }}>
          <Skeleton width={40} height={40} borderRadius="50%" />
          <Skeleton width={80} height={16} style={{ marginLeft: 12 }} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Skeleton width={40} height={16} />
            <Skeleton width={40} height={16} />
          </div>
        </div>
      ))}
    </div>
    
    <BottomNav />
  </div>
));

export default function MyPageOptimized() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hearts, loading: heartsLoading } = useHearts(user?.uid || null);
  const { 
    data: myInfoData, 
    stats, 
    loading: myInfoLoading, 
    error: myInfoError, 
    refetch: refetchMyInfo 
  } = useMyInfo(user?.uid || null);

  // State 관리
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserProfileEditModal, setShowUserProfileEditModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Persona | null>(null);
  const [showProfileCreateModal, setShowProfileCreateModal] = useState(false);
  const [showCharacterEditModal, setShowCharacterEditModal] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showProfileDetailModal, setShowProfileDetailModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = user?.uid || "";

  // 메모이제이션된 데이터
  const personas = useMemo(() => myInfoData?.personas || [], [myInfoData?.personas]);
  const characters = useMemo(() => myInfoData?.characters || [], [myInfoData?.characters]);
  
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      const profile = JSON.parse(saved);
      return { 
        name: profile.name || user?.displayName || "사용자", 
        avatar: profile.avatar || DEFAULT_PROFILE_IMAGE 
      };
    }
    return { 
      name: user?.displayName || "사용자", 
      avatar: DEFAULT_PROFILE_IMAGE 
    };
  });

  // 메모이제이션된 콜백들
  const handleHeartClick = useCallback(() => {
    navigate('/heart-shop');
  }, [navigate]);

  const handleProfileEdit = useCallback((profile: Persona) => {
    setSelectedProfile(profile);
    setShowProfileEditModal(true);
  }, []);

  const handleProfileDelete = useCallback(async (profileId: string) => {
    try {
      await apiDelete(`/api/persona/${profileId}`);
      await refetchMyInfo();
      // 캐시 무효화
      clearMyInfoCache(userId);
    } catch (error) {
      console.error('프로필 삭제 오류:', error);
    }
  }, [refetchMyInfo, userId]);

  const handleProfileClick = useCallback((profile: Persona) => {
    setSelectedProfile(profile);
    setShowProfileDetailModal(true);
  }, []);

  const handleCharacterEdit = useCallback((character: Character) => {
    setSelectedCharacter(character);
    setShowCharacterEditModal(true);
  }, []);

  const handleCharacterDelete = useCallback(async (characterId: number) => {
    try {
      await apiDelete(`/api/character/${characterId}?userId=${userId}`);
      await refetchMyInfo();
      // 캐시 무효화
      clearMyInfoCache(userId);
    } catch (error) {
      console.error('캐릭터 삭제 오류:', error);
    }
  }, [userId, refetchMyInfo]);

  const handleCharacterNavigate = useCallback((characterId: number) => {
    navigate(`/character/${characterId}`);
  }, [navigate]);

  const handleProfileSave = useCallback(async (updatedProfile: Persona) => {
    try {
      await apiPut(`/api/persona/${updatedProfile.id}`, {
        name: updatedProfile.name,
        gender: updatedProfile.gender,
        age: updatedProfile.age,
        job: updatedProfile.job,
        info: updatedProfile.info,
        habit: updatedProfile.habit,
        avatar: updatedProfile.avatar
      });

      setShowProfileEditModal(false);
      await refetchMyInfo();
      clearMyInfoCache(userId);
      
      setAlertTitle('성공');
      setAlertMsg('프로필이 성공적으로 수정되었습니다.');
      setAlertOpen(true);
    } catch (error) {
      console.error('프로필 수정 오류:', error);
      setAlertTitle('오류');
      setAlertMsg('프로필 수정 중 오류가 발생했습니다.');
      setAlertOpen(true);
    }
  }, [refetchMyInfo, userId]);

  const handleProfileCreate = useCallback(async (newProfile: Persona) => {
    try {
      await apiPost('/api/persona', {
        userId,
        name: newProfile.name,
        gender: newProfile.gender,
        age: newProfile.age,
        job: newProfile.job,
        info: newProfile.info,
        habit: newProfile.habit,
        avatar: newProfile.avatar
      });
      
      setShowProfileCreateModal(false);
      await refetchMyInfo();
      clearMyInfoCache(userId);
      
      setAlertTitle('성공');
      setAlertMsg('프로필이 성공적으로 생성되었습니다.');
      setAlertOpen(true);
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 생성 중 오류가 발생했습니다.');
      setAlertOpen(true);
    }
  }, [userId, refetchMyInfo]);

  const handleUserProfileImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newProfileImg = ev.target?.result as string;
        const newProfile = { name: userProfile.name, avatar: newProfileImg };
        setUserProfile(newProfile);
        localStorage.setItem('userProfile', JSON.stringify(newProfile));
      };
      reader.readAsDataURL(file);
    }
  }, [userProfile.name]);

  const handleUserNameSave = useCallback(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    setShowUserProfileEditModal(false);
  }, [userProfile]);

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    localStorage.clear();
    sessionStorage.clear();
    clearMyInfoCache();
    await signOutUser();
  }, []);

  // 로딩 상태
  const isLoading = useMemo(() => 
    authLoading || myInfoLoading, 
    [authLoading, myInfoLoading]
  );

  // 에러 상태 처리
  if (myInfoError) {
    return (
      <div style={{ 
        background: 'var(--color-bg)', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#ff4081',
        fontSize: 18,
        fontWeight: 600,
        gap: 16
      }}>
        <div>사용자 정보를 불러올 수 없습니다</div>
        <button 
          onClick={refetchMyInfo}
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

  // 로딩 중일 때 스켈레톤 표시
  if (isLoading) {
    return <MyPageSkeleton />;
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* 상단 계정(관리용) 프로필 카드 */}
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
            <FiSettings />
          </button>
        </div>
      </div>

      {/* 멀티프로필 섹션 */}
      <div style={{ marginTop: 24, padding: "0 20px" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>멀티프로필</div>
          <button
            onClick={() => setShowProfileCreateModal(true)}
            disabled={personas.length >= 10}
            style={{
              background: 'none',
              border: 'none',
              color: personas.length >= 10 ? '#888' : '#bbb',
              fontWeight: 600,
              fontSize: 16,
              cursor: personas.length >= 10 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title={personas.length >= 10 ? '최대 10개까지 생성할 수 있습니다.' : ''}
          >
            <span style={{ fontSize: 22, marginRight: 6 }}>+</span> 멀티프로필 만들기 ({personas.length}/10)
          </button>
        </div>
        
        {/* 멀티프로필 리스트 */}
        {personas.map((persona) => (
          <ProfileCard
            key={persona.id}
            profile={persona}
            onEdit={handleProfileEdit}
            onDelete={handleProfileDelete}
            onClick={handleProfileClick}
          />
        ))}
      </div>

      {/* 내 캐릭터 섹션 */}
      <div style={{ padding: "0 20px", fontWeight: 700, fontSize: 18, marginTop: 24 }}>내 캐릭터</div>
      <div style={{ padding: "0 20px" }}>
        {characters.length === 0 ? (
          <div style={{ color: "var(--color-subtext)" }}>아직 만든 캐릭터가 없습니다.</div>
        ) : (
          characters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              onEdit={handleCharacterEdit}
              onDelete={handleCharacterDelete}
              onNavigate={handleCharacterNavigate}
            />
          ))
        )}
      </div>

      <BottomNav />
      
      {/* 모달들은 조건부 렌더링으로 최적화 */}
      {showUserProfileEditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ 
            background: 'var(--color-card)', borderRadius: 20, padding: 32, 
            width: '90%', maxWidth: 400, position: 'relative', 
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)' 
          }}>
            <button
              onClick={() => setShowUserProfileEditModal(false)}
              style={{ 
                position: 'absolute', right: 16, top: 16, background: 'none', 
                border: 'none', fontSize: 24, cursor: 'pointer', color: '#fff' 
              }}
              aria-label="닫기"
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 32, textAlign: 'center' }}>
              프로필 수정
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                <OptimizedImage
                  src={userProfile.avatar || DEFAULT_PROFILE_IMAGE}
                  alt="프로필"
                  width={100}
                  height={100}
                  style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff' }}
                  priority={true}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', right: 0, bottom: 0, background: '#ff4081',
                    color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  aria-label="프로필 사진 변경"
                >+</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUserProfileImageChange}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 8 }}>
                이름
              </label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12,
                  border: '1px solid #444', background: '#333', color: '#fff',
                  fontSize: 16, outline: 'none'
                }}
                placeholder="이름을 입력하세요"
              />
            </div>

            <button
              onClick={handleUserNameSave}
              style={{
                width: '100%', background: '#ff4081', color: '#fff', border: 'none',
                borderRadius: 12, padding: 16, fontWeight: 700, fontSize: 18, cursor: 'pointer'
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ 
            background: '#222', borderRadius: 20, padding: 32, 
            width: '90%', maxWidth: 340, position: 'relative', 
            boxShadow: '0 2px 16px rgba(0,0,0,0.18)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center' 
          }}>
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{ 
                position: 'absolute', right: 16, top: 16, background: 'none', 
                border: 'none', fontSize: 24, cursor: 'pointer', color: '#fff' 
              }}
              aria-label="닫기"
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 32 }}>설정</div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{ 
                width: '100%', background: '#ff4081', color: '#fff', 
                border: 'none', borderRadius: 12, padding: 16, 
                fontWeight: 700, fontSize: 18, cursor: 'pointer', marginBottom: 8 
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
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
          <div style={{ 
            background: '#222', borderRadius: 16, padding: '32px 24px', 
            minWidth: 260, maxWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', 
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' 
          }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 12 }}>로그아웃</div>
            <div style={{ color: '#ccc', fontSize: 16, marginBottom: 28 }}>로그아웃 하시겠습니까?</div>
            <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ 
                  flex: 1, background: '#444', color: '#fff', border: 'none', 
                  borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' 
                }}
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                style={{ 
                  flex: 1, background: '#ff4081', color: '#fff', border: 'none', 
                  borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' 
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 관련 모달들 */}
      {showProfileEditModal && selectedProfile && (
        <ProfileEditModal
          isOpen={showProfileEditModal}
          onClose={() => {
            setShowProfileEditModal(false);
            setSelectedProfile(null);
          }}
          profileData={{
            id: selectedProfile.id,
            name: selectedProfile.name,
            gender: selectedProfile.gender || '',
            age: parseInt(selectedProfile.age || '0') || 0,
            job: selectedProfile.job || '',
            info: selectedProfile.info || '',
            habit: selectedProfile.habit || '',
            avatar: selectedProfile.avatar
          }}
          onSave={handleProfileSave}
        />
      )}

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
        />
      )}

      {showCharacterEditModal && selectedCharacter && (
        <CharacterEditModal
          isOpen={showCharacterEditModal}
          onClose={() => {
            setShowCharacterEditModal(false);
            setSelectedCharacter(null);
          }}
          characterData={selectedCharacter}
          onSave={() => {
            setShowCharacterEditModal(false);
            refetchMyInfo();
            clearMyInfoCache(userId);
          }}
        />
      )}

      {showProfileDetailModal && selectedProfile && (
        <ProfileDetailModal
          isOpen={showProfileDetailModal}
          onClose={() => {
            setShowProfileDetailModal(false);
            setSelectedProfile(null);
          }}
          profileData={selectedProfile}
        />
      )}

      {/* 알림 모달 */}
      {alertOpen && (
        <CustomAlert
          isOpen={alertOpen}
          title={alertTitle}
          message={alertMsg}
          onClose={() => setAlertOpen(false)}
        />
      )}
    </div>
  );
} 