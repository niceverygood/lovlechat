import React, { useState, useRef, useEffect } from "react";
import DefaultProfileImage from "./DefaultProfileImage";

const hashtags = [
  "#소유욕", "#츤데레", "#능글남", "#집착남", "#연상남", "#질투", "#까칠남", "#다정남주", "#무심남", "#대형견남", "#잘생김", "#순정남", "#계략남", "#첫사랑", "#야한", "#상처남", "#직진남", "#집착", "#다정", "#갑을관계", "#연하남", "#인외", "#금지된사랑", "#무뚝뚝", "#소꿉친구", "#존댓말남", "#귀여움", "#다정남", "#순애", "#재벌남", "#힐링", "#싸가지", "#능글", "#로맨스코미디", "#남자", "#혐관", "#로맨스", "#까칠", "#연상", "#자캐", "#강수위", "#신분차이", "#존잘", "#미남", "#초월적존재", "#미친놈", "#학원물", "#반말", "#운명적사랑", "#햇살캐", "#여자", "#오만남", "#피폐", "#판타지", "#독점욕", "#너드", "#욕망", "#아저씨"
];
const categories = [
  "애니메이션 & 만화 주인공", "게임 캐릭터", "순수창작 캐릭터", "셀러브리티", "영화 & 드라마 주인공", "버튜버", "기타"
];

export default function CharacterEditModal({ isOpen, onClose, characterData, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  characterData: any;
  onSave: (updated: any) => void;
}) {
  const [gender, setGender] = useState("설정하지 않음");
  const [scope, setScope] = useState("비공개");
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

  useEffect(() => {
    if (isOpen && characterData) {
      setGender(characterData.gender || "설정하지 않음");
      setScope(characterData.scope || "비공개");
      setCategory(typeof characterData.category === 'string' ? characterData.category : "");
      setSelectedTags(Array.isArray(characterData.selectedTags) ? characterData.selectedTags : []);
      setProfileImg(characterData.profileImg || null);
      setName(characterData.name || "");
      setAge(characterData.age?.toString() || "");
      setJob(characterData.job || "");
      setOneLiner(characterData.oneLiner || "");
      setBackground(characterData.background || "");
      setPersonality(characterData.personality || "");
      setHabit(characterData.habit || "");
      setLike(characterData.like || "");
      setDislike(characterData.dislike || "");
      setFirstScene(characterData.firstScene || "");
      setFirstMessage(characterData.firstMessage || "");
      setBackgroundImg(characterData.backgroundImg || null);
      setExtraInfos(Array.isArray(characterData.extraInfos) ? characterData.extraInfos : []);
    }
  }, [isOpen, characterData]);

  const handleProfileImgClick = () => fileInputRef.current?.click();
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

  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstScene.trim()) {
      alert("첫 상황을 입력해주세요.");
      return;
    }
    if (!firstMessage.trim()) {
      alert("채팅 첫 마디를 입력해주세요.");
      return;
    }
    const updated = {
      ...characterData,
      gender,
      scope,
      category,
      selectedTags,
      profileImg,
      name,
      age,
      job,
      oneLiner,
      background,
      personality,
      habit,
      like,
      dislike,
      extraInfos,
      firstScene,
      firstMessage,
      backgroundImg
    };
    onSave(updated);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto'
    }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: 24, width: '100%', maxWidth: 480, maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 4px 32px rgba(0,0,0,0.25)', margin: 16 }}>
        <div style={{ padding: '24px 20px 0 20px', fontWeight: 700, fontSize: 24 }}>캐릭터 수정하기</div>
        {/* 프로필 사진 업로드 */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 8 }}>
          <div style={{ position: "relative", width: 90, height: 90 }}>
            {profileImg ? (
              <img
                src={profileImg}
                alt="프로필"
                style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--color-border)" }}
              />
            ) : (
              <DefaultProfileImage />
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
        <form onSubmit={handleSubmit}>
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>캐릭터 기본 설정</div>
            <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)" }} maxLength={15} />
            <input type="number" placeholder="나이" value={age} onChange={e => setAge(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)" }} min="0" max="150" />
            <input placeholder="직업" value={job} onChange={e => setJob(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)" }} maxLength={15} />
            <input placeholder="캐릭터 한 마디" value={oneLiner} onChange={e => setOneLiner(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 12, background: "var(--color-card)", color: "var(--color-text)" }} maxLength={80} />
            <textarea placeholder="배경, 가족, MBTI, 키 등을 입력해주세요" value={background} onChange={e => setBackground(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)" }} rows={3} maxLength={700} />
            <textarea placeholder="성격을 입력해주세요" value={personality} onChange={e => setPersonality(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)" }} rows={3} maxLength={700} />
            <textarea placeholder="습관적인 말과 행동 (예시를 입력해주세요)" value={habit} onChange={e => setHabit(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)" }} rows={3} maxLength={700} />
            {/* 좋아하는 것, 싫어하는 것 */}
            <textarea placeholder="좋아하는 것 (선택)" value={like} onChange={e => setLike(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)" }} rows={2} maxLength={50} />
            <textarea placeholder="싫어하는 것 (선택)" value={dislike} onChange={e => setDislike(e.target.value)} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--color-border)", padding: 12, fontSize: 15, marginBottom: 16, resize: "none", background: "var(--color-card)", color: "var(--color-text)" }} rows={2} maxLength={50} />
          </div>
          {/* 게시 범위 설정 */}
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>게시 범위 설정</div>
            <label style={{ marginRight: 18 }}>
              <input type="radio" checked={scope === "공개"} onChange={() => setScope("공개")}/> 공개
            </label>
            <label>
              <input type="radio" checked={scope === "비공개"} onChange={() => setScope("비공개")}/> 비공개
            </label>
          </div>
          {/* 해시태그 추가 */}
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>해시태그 추가</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hashtags.map(tag => (
                <span
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  style={{
                    background: selectedTags.includes(tag) ? '#ff4081' : '#222',
                    color: selectedTags.includes(tag) ? '#fff' : '#bbb',
                    borderRadius: 12,
                    padding: '6px 14px',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer',
                    border: selectedTags.includes(tag) ? '2px solid #ff4081' : '1.5px solid #333',
                    userSelect: 'none'
                  }}
                >{tag}</span>
              ))}
            </div>
          </div>
          {/* 카테고리 선택 */}
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>카테고리 선택</div>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  width: '100%',
                  marginBottom: 10,
                  background: category === cat ? '#ff4081' : '#18141a',
                  color: category === cat ? '#fff' : '#bbb',
                  border: 'none',
                  borderRadius: 16,
                  padding: '14px 0',
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: 'pointer',
                  boxShadow: category === cat ? '0 2px 8px #ff408155' : 'none'
                }}
              >{cat}</button>
            ))}
          </div>
          {/* 채팅 첫 장면 설정 */}
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>채팅 첫 장면 설정</div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>첫 상황 <span style={{ color: '#ff4081', fontWeight: 400, fontSize: 14 }}>(필수)</span></div>
            <textarea
              placeholder="예) 자기전, 캐릭터가 심심해서 선톡을 한 상황"
              value={firstScene}
              onChange={e => setFirstScene(e.target.value)}
              style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid var(--color-border)', padding: 12, fontSize: 15, marginBottom: 12, background: 'var(--color-card)', color: 'var(--color-text)', resize: 'none' }}
              rows={3}
              maxLength={800}
            />
            <div style={{ marginBottom: 8, fontWeight: 600 }}>채팅 첫 마디 <span style={{ color: '#ff4081', fontWeight: 400, fontSize: 14 }}>(필수)</span></div>
            <textarea
              placeholder="예) 앞으로 내 톡 받으면 3초 안에 답장해줘"
              value={firstMessage}
              onChange={e => setFirstMessage(e.target.value)}
              style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid var(--color-border)', padding: 12, fontSize: 15, marginBottom: 12, background: 'var(--color-card)', color: 'var(--color-text)', resize: 'none' }}
              rows={2}
              maxLength={200}
            />
          </div>
          {/* 배경 이미지 */}
          <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>배경 이미지 <span style={{ color: '#bbb', fontWeight: 400, fontSize: 14 }}>(선택, 9:16 비율 권장)</span></div>
            <div style={{ marginBottom: 8, color: '#bbb', fontSize: 14 }}>이미지를 등록하지 않으면 캐릭터 프로필 사진이 배경으로 활용됩니다.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 80, height: 140, border: '2px dashed var(--color-point)', borderRadius: 16, background: '#18141a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={handleBackgroundImgClick}>
                {backgroundImg ? (
                  <img src={backgroundImg} alt="배경" style={{ width: 80, height: 140, objectFit: 'cover', borderRadius: 16 }} />
                ) : (
                  <span style={{ color: '#ff4081', fontSize: 32, fontWeight: 700 }}>+</span>
                )}
                {backgroundImg && (
                  <button type="button" onClick={handleRemoveBackgroundImg} style={{ position: 'absolute', top: 4, right: 4, background: '#ff4081', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer' }}>×</button>
                )}
                <input ref={backgroundImgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBackgroundImgChange} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: 24, gap: 12 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, maxWidth: 160, background: '#444', color: '#fff', border: 'none', borderRadius: 28, padding: 16, fontWeight: 700, fontSize: 20, cursor: 'pointer', marginRight: 8 }}>취소</button>
            <button type="submit" style={{ flex: 1, maxWidth: 160, background: '#ff4081', color: '#fff', border: 'none', borderRadius: 28, padding: 16, fontWeight: 700, fontSize: 20, cursor: 'pointer' }}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 