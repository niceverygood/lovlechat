import React, { useEffect, useState, useRef } from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { FiSettings } from "react-icons/fi";
import ProfileEditModal from "../components/ProfileEditModal";
import CharacterEditModal from "../components/CharacterEditModal";
import ProfileDetailModal from "../components/ProfileDetailModal";
import { signOutUser } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useHearts } from "../hooks/useHearts";
import { useMyInfo, clearMyInfoCache } from "../hooks/useMyInfo";
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
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

// 프로필 이미지 경로 상수로 지정 (이제 constants에서 import)


// HeartButton 컴포넌트 분리
function HeartButton({ count }: { count: number }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/heart-shop')}
      style={{
        display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18, color: "#ff4081",
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: 0
      }}
    >
      <span style={{ marginRight: 4 }}>보유 하트</span>
      {count} <span role="img" aria-label="하트" style={{ marginLeft: 4, fontSize: 20 }}>❤️</span>
    </button>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hearts, loading: heartsLoading } = useHearts(user?.uid || null);
  const { data: myInfoData, stats, loading: myInfoLoading, error: myInfoError, refetch: refetchMyInfo } = useMyInfo(user?.uid || null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserProfileEditModal, setShowUserProfileEditModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Persona | null>(null);
  const userId = user?.uid || "";
  const [userProfile, setUserProfile] = useState<{ name: string; avatar: string }>({ name: user?.displayName || "사용자", avatar: DEFAULT_PROFILE_IMAGE });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showProfileCreateModal, setShowProfileCreateModal] = useState(false);
  const [showCharacterEditModal, setShowCharacterEditModal] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
  const [showProfileDetailModal, setShowProfileDetailModal] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // MyInfo에서 페르소나 데이터 가져오기
  const personas = myInfoData?.personas || [];

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }
    
    if (!userId) {
      console.log('userId가 없음:', userId, 'user:', user);
      setLoading(false);
      return;
    }
    console.log('MyPage 캐릭터 데이터 로딩 시작, userId:', userId);
    setLoading(true);
    // 캐릭터 데이터만 별도로 로딩 (페르소나는 useMyInfo에서 관리)
    apiGet(`/api/character?userId=${userId}`)
      .then((characterData) => {
        console.log('API 응답 - characterData:', characterData);
        
        if (characterData.ok) {
          console.log('캐릭터 설정:', characterData.characters);
          const charactersWithTags = characterData.characters.map((char: any) => ({
            ...char,
            selectedTags: Array.isArray(char.tags)
              ? char.tags
              : (typeof char.tags === 'string' && char.tags.startsWith('['))
                ? JSON.parse(char.tags)
                : (typeof char.tags === 'string' && char.tags.length > 0)
                  ? char.tags.split(',').map((t: string) => t.trim())
                  : [],
          }));
          setCharacters(charactersWithTags);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('캐릭터 데이터 로딩 오류:', error);
        setLoading(false);
        setAlertTitle('오류');
        setAlertMsg('캐릭터 데이터를 불러오는 중 오류가 발생했습니다.');
        setAlertOpen(true);
      });

    // 사용자 프로필 정보 불러오기 (localStorage에서)
    const savedUserProfile = localStorage.getItem('userProfile');
    if (savedUserProfile) {
      const profile = JSON.parse(savedUserProfile);
      setUserProfile({ name: profile.name || user?.displayName || "사용자", avatar: profile.avatar || DEFAULT_PROFILE_IMAGE });
    }

    // 팔로워/팔로잉 수 불러오기 (추후 실제 API 연동)
    setFollowerCount(2);
    setFollowingCount(0);
  }, [userId, authLoading]);

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

  const handleProfileEdit = (profile: Persona) => {
    setSelectedProfile(profile);
    setShowProfileEditModal(true);
  };

  // 멀티프로필 목록 최신화 함수 (useMyInfo 사용)
  const fetchPersonas = async () => {
    try {
      await refetchMyInfo();
    } catch (error) {
      console.error('fetchPersonas 에러:', error);
    }
  };

  const handleProfileSave = async (updatedProfile: Persona) => {
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
      await fetchPersonas(); // 최신 목록으로 갱신
      setAlertTitle('성공');
      setAlertMsg('프로필이 성공적으로 수정되었습니다.');
      setAlertOpen(true);
    } catch (error) {
      console.error('프로필 수정 오류:', error);
      setAlertTitle('오류');
      setAlertMsg('프로필 수정 중 오류가 발생했습니다.');
      setAlertOpen(true);
    }
  };

  // 멀티프로필 생성 핸들러
  const handleProfileCreate = async (newProfile: Persona) => {
    try {
      const resData = await apiPost('/api/persona', {
        userId,
        name: newProfile.name,
        gender: newProfile.gender,
        age: newProfile.age,
        job: newProfile.job,
        info: newProfile.info,
        habit: newProfile.habit,
        avatar: newProfile.avatar
      });
      
      console.log('생성된 프로필:', resData);
      
      // 모달 먼저 닫기
      setShowProfileCreateModal(false);
      
      // 약간 지연 후 목록 갱신 (UI 안정성)
      setTimeout(async () => {
        await fetchPersonas();
        setAlertTitle('성공');
        setAlertMsg('프로필이 성공적으로 생성되었습니다.');
        setAlertOpen(true);
      }, 100);
    } catch (error) {
      setAlertTitle('오류');
      setAlertMsg('프로필 생성 중 오류가 발생했습니다.');
      setAlertOpen(true);
    }
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {(loading || myInfoLoading) ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh',
          color: '#fff',
          fontSize: 18,
          fontWeight: 600
        }}>
          데이터를 불러오는 중...
        </div>
      ) : myInfoError ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh',
          color: '#ff4081',
          fontSize: 18,
          fontWeight: 600,
          flexDirection: 'column',
          gap: 16
        }}>
          <div>사용자 정보를 불러올 수 없습니다</div>
          <button 
            onClick={() => refetchMyInfo()}
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
      ) : (
        <>
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
              <img
                src={userProfile.avatar || DEFAULT_PROFILE_IMAGE}
                alt="프로필"
                style={{ width: 60, height: 60, borderRadius: "50%", marginRight: 16, objectFit: "cover", background: "#222", border: "2px solid #333", cursor: "pointer" }}
                onClick={() => setShowProfileDetailModal(true)}
                onError={handleProfileImageError}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{userProfile.name}</div>
                <HeartButton count={heartsLoading ? 0 : hearts} />
              </div>
            </div>
            <div style={{ textAlign: "right", display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowUserProfileEditModal(true)}
                style={{ background: '#fff', border: 'none', color: '#222', fontWeight: 600, fontSize: 15, cursor: 'pointer', borderRadius: 16, padding: '8px 18px', marginBottom: 8 }}
              >
                내 프로필
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer', padding: 0 }}
                aria-label="설정"
                title="설정"
              >
                {typeof FiSettings === 'function' ? <FiSettings /> : null}
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
            {personas.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", background: "var(--color-card-alt)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <img
                      src={p.avatar || DEFAULT_PROFILE_IMAGE}
                      alt={p.name}
                  style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12, objectFit: "cover", background: "#222", border: "1.5px solid #333", cursor: 'pointer' }}
                  onClick={() => { setSelectedProfile(p); setShowProfileDetailModal(true); }}
                    onError={handleProfileImageError}
                  />
                <span style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</span>
              <button
                style={{ marginLeft: "auto", color: "#4CAF50", background: "none", border: "none", fontSize: 16, cursor: "pointer" }}
                onClick={() => handleProfileEdit(p)}
              >수정</button>
              <button
                style={{ color: "#ff4081", background: "none", border: "none", fontSize: 16, cursor: "pointer", marginLeft: 8 }}
                onClick={async () => {
                  if (window.confirm("정말로 삭제하시겠습니까?")) {
                    await apiDelete(`/api/persona/${p.id}`);
                    await refetchMyInfo(); // 삭제 후 MyInfo 새로고침
                  }
                }}
              >삭제</button>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 20px", fontWeight: 700, fontSize: 18, marginTop: 24 }}>내 캐릭터</div>
          <div style={{ padding: "0 20px" }}>
            {characters.length === 0 ? (
              <div style={{ color: "var(--color-subtext)" }}>아직 만든 캐릭터가 없습니다.</div>
            ) : (
              characters.map(char => (
                <div key={char.id} style={{ display: "flex", alignItems: "center", background: "var(--color-card)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <img
                    src={char.profileImg || DEFAULT_PROFILE_IMAGE}
                    alt={char.name}
                    style={{ width: 48, height: 48, borderRadius: "50%", marginRight: 12, objectFit: "cover", cursor: "pointer" }}
                    onClick={() => navigate(`/character/${char.id}`)}
                    onError={handleProfileImageError}
                  />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{char.name}</span>
                  <button 
                    style={{ marginLeft: "auto", marginRight: 12, color: "#4CAF50", background: "none", border: "none", fontSize: 16, cursor: "pointer" }}
                    onClick={() => { setSelectedCharacter(char); setShowCharacterEditModal(true); }}
                  >수정</button>
                  <button 
                    style={{ color: "#ff4081", background: "none", border: "none", fontSize: 16, cursor: "pointer" }}
                    onClick={async () => {
                      if (window.confirm("정말로 삭제하시겠습니까?")) {
                        await apiDelete(`/api/character/${char.id}?userId=${userId}`);
                        // 삭제(숨김) 후 목록을 서버에서 다시 fetch
                        const data = await apiGet(`/api/character?userId=${userId}`);
                        if (data.ok) setCharacters(data.characters);
                      }
                    }}
                  >삭제</button>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <BottomNav />
      
      {/* 유저 프로필 수정 모달 */}
      {showUserProfileEditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 20, padding: 32, width: '90%', maxWidth: 400, position: 'relative', boxShadow: '0 2px 16px rgba(0,0,0,0.18)' }}>
            <button
              onClick={() => setShowUserProfileEditModal(false)}
              style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#fff' }}
              aria-label="닫기"
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 32, textAlign: 'center' }}>프로필 수정</div>
            
            {/* 프로필 이미지 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={userProfile.avatar || DEFAULT_PROFILE_IMAGE}
                  alt="프로필"
                  style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff' }}
                  onError={handleProfileImageError}
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
              <label style={{ display: 'block', fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 8 }}>이름</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #444',
                  background: '#333',
                  color: '#fff',
                  fontSize: 16,
                  outline: 'none'
                }}
                placeholder="이름을 입력하세요"
              />
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleUserNameSave}
              style={{
                width: '100%',
                background: '#ff4081',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: 16,
                fontWeight: 700,
                fontSize: 18,
                cursor: 'pointer'
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
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{ background: '#222', borderRadius: 20, padding: 32, width: '90%', maxWidth: 340, position: 'relative', boxShadow: '0 2px 16px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#fff' }}
              aria-label="닫기"
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 32 }}>설정</div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{ width: '100%', background: '#ff4081', color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontWeight: 700, fontSize: 18, cursor: 'pointer', marginBottom: 8 }}
            >로그아웃</button>
          </div>
        </div>
      )}

      {/* 로그아웃 확인 모달 */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
          <div style={{ background: '#222', borderRadius: 16, padding: '32px 24px', minWidth: 260, maxWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 12 }}>로그아웃</div>
            <div style={{ color: '#ccc', fontSize: 16, marginBottom: 28 }}>로그아웃 하시겠습니까?</div>
            <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, background: '#444', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
              >취소</button>
              <button
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  localStorage.clear();
                  sessionStorage.clear();
                  await signOutUser();
                  // 로그아웃 후 게스트 모드로 전환되고 홈으로 이동되므로 navigate 제거
                }}
                style={{ flex: 1, background: '#ff4081', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
              >로그아웃</button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 수정 모달 */}
      {showProfileEditModal && selectedProfile && (
        <ProfileEditModal
          isOpen={showProfileEditModal}
          onClose={async () => {
            setShowProfileEditModal(false);
            setSelectedProfile(null);
            await fetchPersonas(); // 모달 닫을 때도 최신화
          }}
          profileData={{
            id: selectedProfile.id,
            name: selectedProfile.name,
            gender: selectedProfile.gender || '',
            age: parseInt(selectedProfile.age || '0') || 0,
            job: selectedProfile.job || '',
            info: selectedProfile.info || '',
            habit: selectedProfile.habit || '',
            avatar: selectedProfile.avatar || DEFAULT_PROFILE_IMAGE
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

      {/* 캐릭터 수정 모달 */}
      {showCharacterEditModal && selectedCharacter && (
        <CharacterEditModal
          isOpen={showCharacterEditModal}
          onClose={() => { setShowCharacterEditModal(false); setSelectedCharacter(null); }}
          characterData={selectedCharacter}
          onSave={async (updated: Character) => {
            try {
              await apiPut(`/api/character/${updated.id}`, updated);
              setShowCharacterEditModal(false);
              setSelectedCharacter(null);
              // 목록 갱신
              const data = await apiGet(`/api/character?userId=${userId}`);
              if (data.ok) setCharacters(data.characters);
            } catch (error: any) {
              setAlertTitle('오류');
              setAlertMsg(error.message || '저장 중 오류가 발생했습니다.');
              setAlertOpen(true);
            }
          }}
        />
      )}

      {/* 유저 프로필 상세 모달 */}
      {showProfileDetailModal && selectedProfile && (
        <ProfileDetailModal
          isOpen={showProfileDetailModal}
          onClose={() => setShowProfileDetailModal(false)}
          profile={selectedProfile}
          isMe={true}
        />
      )}

      <CustomAlert open={alertOpen} title={alertTitle} message={alertMsg} onConfirm={() => setAlertOpen(false)} />
    </div>
  );
}