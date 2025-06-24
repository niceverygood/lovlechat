import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DefaultProfileImage from "../components/DefaultProfileImage";
import Toast from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from '../lib/openai';
import { DEFAULT_PROFILE_IMAGE } from '../utils/constants';

const hashtags = [
  "#소유욕", "#츤데레", "#능글남", "#집착남", "#연상남", "#질투", "#까칠남", "#다정남주", "#무심남", "#대형견남", "#잘생김", "#순정남", "#계략남", "#첫사랑", "#야한", "#상처남", "#직진남", "#집착", "#다정", "#갑을관계", "#연하남", "#인외", "#금지된사랑", "#무뚝뚝", "#소꿉친구", "#존댓말남", "#귀여움", "#다정남", "#순애", "#재벌남", "#힐링", "#싸가지", "#능글", "#로맨스코미디", "#남자", "#혐관", "#로맨스", "#까칠", "#연상", "#자캐", "#강수위", "#신분차이", "#존잘", "#미남", "#초월적존재", "#미친놈", "#학원물", "#반말", "#운명적사랑", "#햇살캐", "#여자", "#오만남", "#피폐", "#판타지", "#독점욕", "#너드", "#욕망", "#아저씨"
];

const categories = [
  "애니메이션 & 만화 주인공", "게임 캐릭터", "순수창작 캐릭터", "셀러브리티", "영화 & 드라마 주인공", "버튜버", "기타"
];

export default function CharacterCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gender, setGender] = useState("설정하지 않음");
  const [scope, setScope] = useState("공개");
  const [roomCode, setRoomCode] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraInfos, setExtraInfos] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [job, setJob] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [background, setBackground] = useState("");
  const [personality, setPersonality] = useState("");
  const [habit, setHabit] = useState("");
  const [like, setLike] = useState("");
  const [dislike, setDislike] = useState("");
  const [firstScene, setFirstScene] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [backgroundImg, setBackgroundImg] = useState<string | null>(null);
  const backgroundImgInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState<{ id: string } | null>(null);

  const handleProfileImgClick = () => {
    fileInputRef.current?.click();
  };
  const handleProfileImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProfileImg(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExtraInfo = () => {
    if (extraInfos.length < 10) {
      setExtraInfos([...extraInfos, ""]);
    }
  };
  const handleRemoveExtraInfo = (idx: number) => {
    setExtraInfos(extraInfos.filter((_, i) => i !== idx));
  };
  const handleChangeExtraInfo = (idx: number, value: string) => {
    setExtraInfos(extraInfos.map((info, i) => (i === idx ? value : info)));
  };

  const handleBackgroundImgClick = () => {
    if (backgroundImg) return;
    backgroundImgInputRef.current?.click();
  };
  const handleBackgroundImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBackgroundImg(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleRemoveBackgroundImg = () => setBackgroundImg(null);

  const handleSubmit = async () => {
    if (!profileImg) {
      setToast({ message: "프로필 사진을 추가해주세요.", type: "error" });
      return;
    }
    if (!name.trim()) {
      setToast({ message: "캐릭터 이름을 입력해주세요.", type: "error" });
      return;
    }
    if (name.trim().length < 2) {
      setToast({ message: "캐릭터 이름은 2글자 이상이어야 합니다.", type: "error" });
      return;
    }
    if (!age || parseInt(age) < 1 || parseInt(age) > 150) {
      setToast({ message: "나이를 올바르게 입력해주세요. (1-150세)", type: "error" });
      return;
    }
    if (!job.trim()) {
      setToast({ message: "직업을 입력해주세요.", type: "error" });
      return;
    }
    if (!oneLiner.trim()) {
      setToast({ message: "캐릭터 한 마디를 입력해주세요.", type: "error" });
      return;
    }
    if (!background.trim()) {
      setToast({ message: "캐릭터 배경을 입력해주세요.", type: "error" });
      return;
    }
    if (!personality.trim()) {
      setToast({ message: "성격을 입력해주세요.", type: "error" });
      return;
    }
    if (!firstScene.trim()) {
      setToast({ message: "첫 상황을 입력해주세요.", type: "error" });
      return;
    }
    if (!firstMessage.trim()) {
      setToast({ message: "채팅 첫 마디를 입력해주세요.", type: "error" });
      return;
    }
    if (!category) {
      setToast({ message: "카테고리를 선택해주세요.", type: "error" });
      return;
    }
    
    setLoading(true);
    
    try {
      const payload = {
        userId: user?.uid || "",
        profileImg,
        name: name.trim(),
        age: parseInt(age),
        job: job.trim(),
        oneLiner: oneLiner.trim(),
        background: background.trim(),
        personality: personality.trim(),
        habit: habit.trim(),
        like: like.trim(),
        dislike: dislike.trim(),
        extraInfos: extraInfos.filter(info => info.trim()),
        gender,
        scope,
        roomCode: roomCode.trim(),
        category,
        selectedTags,
        firstScene: firstScene.trim(),
        firstMessage: firstMessage.trim(),
        backgroundImg,
      };
      
      const response = await fetch(`${API_BASE_URL}/api/character`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.id) {
        if (data.message) {
          setToast({ message: data.message, type: "success" });
        }
        
        if (data.fallback) {
          setToast({ 
            message: "캐릭터가 임시 저장되었습니다. 잠시 후 다시 확인해주세요.", 
            type: "success" 
          });
        }
        
        setShowSuccessModal({ id: data.id.toString() });
      } else {
        throw new Error(data.error || '캐릭터 생성에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('Character creation error:', error);
      
      const errorMessage = error.message?.includes('HTTP') 
        ? "서버 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요."
        : error.message || "캐릭터 저장 중 오류가 발생했습니다.";
        
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* 상단 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: "24px 20px 0 20px" }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#fff', 
            fontSize: 28, 
            marginRight: 12,
            cursor: 'pointer',
            padding: 4
          }}
          aria-label="뒤로가기"
        >
          &larr;
        </button>
        <span style={{ fontWeight: 700, fontSize: 24 }}>캐릭터 제작하기</span>
      </div>
      {/* 프로필 사진 업로드 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          프로필 사진 <span style={{ color: 'var(--color-point)', fontWeight: 700, fontSize: 14 }}>(필수)</span>
        </div>
        <div style={{ position: "relative", width: 90, height: 90 }}>
          {profileImg ? (
            <img
              src={profileImg}
              alt="프로필"
              style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--color-border)" }}
            />
          ) : (
            <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', background: '#1F1B24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-border)' }}>
              <DefaultProfileImage />
            </div>
          )}
          <button
            type="button"
            onClick={handleProfileImgClick}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              background: "var(--color-point)",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
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
      {/* 기본 설정 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>캐릭터 기본 설정</div>
        <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} maxLength={15} />
        <input type="number" placeholder="나이" value={age} onChange={e => setAge(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} min="0" max="150" />
        <input placeholder="직업" value={job} onChange={e => setJob(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} maxLength={15} />
        <input placeholder="캐릭터 한 마디" value={oneLiner} onChange={e => setOneLiner(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} maxLength={80} />
        <textarea placeholder="배경, 가족, MBTI, 키 등을 입력해주세요" value={background} onChange={e => setBackground(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} rows={3} maxLength={700} />
        <textarea placeholder="성격을 입력해주세요" value={personality} onChange={e => setPersonality(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} rows={3} maxLength={700} />
        <textarea placeholder="습관적인 말과 행동 (예시를 입력해주세요)" value={habit} onChange={e => setHabit(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} rows={3} maxLength={700} />
      </div>
      {/* 세부 설정 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>캐릭터 세부 설정</div>
        <textarea placeholder="좋아하는 것 (선택)" value={like} onChange={e => setLike(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} rows={2} maxLength={50} />
        <textarea placeholder="싫어하는 것 (선택)" value={dislike} onChange={e => setDislike(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }} rows={2} maxLength={50} />
        {extraInfos.map((info, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <input
              type="text"
              value={info}
              onChange={e => handleChangeExtraInfo(idx, e.target.value)}
              placeholder={`부가 정보 ${idx + 1}`}
              maxLength={50}
              style={{ flex: 1, borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginRight: 8, background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => handleRemoveExtraInfo(idx)} style={{ background: "none", border: "none", color: "var(--color-point)", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddExtraInfo}
          disabled={extraInfos.length >= 10}
          style={{ width: "100%", background: "var(--color-card-alt)", border: "none", borderRadius: 12, padding: 12, fontWeight: 600, color: extraInfos.length >= 10 ? "#ccc" : "var(--color-point)", marginBottom: 8, cursor: extraInfos.length >= 10 ? "not-allowed" : "pointer" }}
        >
          + 부가 정보 추가 ({extraInfos.length}/10)
        </button>
      </div>
      {/* 게시 범위 설정 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>게시 범위 설정</div>
        <label><input type="radio" checked={scope === "공개"} onChange={() => setScope("공개")} /> 공개</label>
        <label style={{ marginLeft: 16 }}><input type="radio" checked={scope === "비공개"} onChange={() => setScope("비공개")} /> 비공개</label>
      </div>
      {/* 해시태그 선택 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
          해시태그 추가 <span style={{ color: 'var(--color-point)', fontWeight: 700, fontSize: 15 }}>({selectedTags.length}/7)</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {hashtags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            const isDisabled = !isSelected && selectedTags.length >= 7;
            return (
              <button
                key={tag}
                onClick={() => {
                  if (isSelected) setSelectedTags(selectedTags.filter(t => t !== tag));
                  else if (!isDisabled) setSelectedTags([...selectedTags, tag]);
                }}
                disabled={isDisabled}
                style={{
                  background: isSelected ? "var(--color-point)" : "var(--color-card-alt)",
                  color: isSelected ? "#fff" : "var(--color-text)",
                  border: "none",
                  borderRadius: 16,
                  padding: "6px 16px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.5 : 1
                }}
              >{tag}</button>
            );
          })}
        </div>
      </div>
      {/* 카테고리 선택 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>카테고리 선택</div>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              width: "100%",
              background: category === cat ? "var(--color-point)" : "var(--color-card-alt)",
              color: category === cat ? "#fff" : "var(--color-text)",
              border: "none",
              borderRadius: 24,
              padding: "12px 0",
              fontWeight: 600,
              fontSize: 17,
              marginBottom: 12,
              cursor: "pointer"
            }}
          >{cat}</button>
        ))}
      </div>
      {/* 첫 상황, 채팅 첫마디, 배경 이미지 */}
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>채팅 첫 장면 설정</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>첫 상황 <span style={{ color: 'var(--color-point)', fontWeight: 700, fontSize: 14 }}>(필수)</span></div>
          <textarea
            placeholder="예) 자기전, 캐릭터가 심심해서 선톡을 한 상황"
            value={firstScene}
            onChange={e => setFirstScene(e.target.value.slice(0, 800))}
            style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 4, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }}
            rows={3}
            maxLength={800}
          />
          <div style={{ color: 'var(--color-subtext)', fontSize: 13, textAlign: 'right' }}>{firstScene.length}/800</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>채팅 첫 마디 <span style={{ color: 'var(--color-point)', fontWeight: 700, fontSize: 14 }}>(필수)</span></div>
          <textarea
            placeholder="예) 앞으로 내 톡 받으면 3초 안에 답장해줘"
            value={firstMessage}
            onChange={e => setFirstMessage(e.target.value.slice(0, 800))}
            style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 4, resize: "none", background: "var(--color-card)", color: "var(--color-text)", boxSizing: 'border-box' }}
            rows={3}
            maxLength={800}
          />
          <div style={{ color: 'var(--color-subtext)', fontSize: 13, textAlign: 'right' }}>{firstMessage.length}/800</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>배경 이미지 <span style={{ color: 'var(--color-subtext)', fontWeight: 400, fontSize: 14 }}>(선택, 9:16 비율 권장)</span></div>
          <div style={{ color: 'var(--color-subtext)', fontSize: 13, marginBottom: 8 }}>이미지를 등록하지 않으면 캐릭터 프로필 사진이 배경으로 활용됩니다.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {(backgroundImg || profileImg) ? (
              <div style={{ position: "relative" }}>
                <img src={backgroundImg || profileImg || DEFAULT_PROFILE_IMAGE} alt="배경" style={{ width: 120, height: 213, borderRadius: 12, objectFit: "cover", border: "1px solid var(--color-border)" }} />
                {backgroundImg && (
                  <button type="button" onClick={handleRemoveBackgroundImg} style={{ position: "absolute", top: -8, right: -8, background: "var(--color-point)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, fontSize: 14, cursor: "pointer" }}>✕</button>
                )}
              </div>
            ) :
              <button type="button" onClick={handleBackgroundImgClick} style={{ width: 120, height: 213, borderRadius: 12, border: "1.5px dashed var(--color-point)", background: "var(--color-card-alt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "var(--color-point)", cursor: "pointer", position: 'relative' }}>
                <span style={{
                  background: "var(--color-point)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}>+</span>
              </button>
            }
            <input ref={backgroundImgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBackgroundImgChange} />
          </div>
        </div>
      </div>
      {/* 완료 버튼 */}
      <button
        onClick={handleSubmit}
        style={{
          width: "90%",
          margin: "24px 5% 32px 5%",
          background: "var(--color-point)",
          color: "#fff",
          border: "none",
          borderRadius: 32,
          padding: "18px 0",
          fontWeight: 700,
          fontSize: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          cursor: "pointer"
        }}
        disabled={loading}
      >완료</button>
      {loading && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#222', color: '#fff', borderRadius: 18, padding: '18px 32px', fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>저장 중</span>
            <span className="dots-indicator">●●●</span>
          </div>
          <style>{`
            .dots-indicator {
              display: inline-block;
              font-size: 22px;
              letter-spacing: 2px;
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
      {showSuccessModal && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 22, padding: '40px 28px 32px 28px', minWidth: 260, maxWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#ff4081', marginBottom: 24 }}>캐릭터가 생성되었습니다!</div>
            <button
              style={{ background: '#ff4081', color: '#fff', border: 'none', borderRadius: 16, padding: '16px 0', fontWeight: 700, fontSize: 18, width: '100%', cursor: 'pointer', marginTop: 8 }}
              onClick={() => navigate(`/character/${showSuccessModal.id}`)}
            >캐릭터 확인하기</button>
          </div>
        </div>
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
} 