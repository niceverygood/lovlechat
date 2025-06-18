import React, { useState, useEffect, useRef } from 'react';

interface ProfileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    avatar: string;
    gender?: string;
    age?: string;
    job?: string;
    info?: string;
    habit?: string;
  };
  editMode?: boolean;
  onSave?: () => void; // 저장 후 목록 갱신용 콜백
  followerCount?: number;
  followingCount?: number;
  characters?: Array<{ id: number; profileImg: string; name: string; age?: string; job?: string; }>;
  isMe?: boolean;
}

export default function ProfileDetailModal({ isOpen, onClose, profile, editMode = false, onSave, followerCount = 0, followingCount = 0, characters = [], isMe = false }: ProfileDetailModalProps) {
  const [isEdit, setIsEdit] = useState(editMode);
  const [name, setName] = useState(profile.name || "");
  const [avatar, setAvatar] = useState(profile.avatar || "/imgdefault.jpg");
  const [gender, setGender] = useState(profile.gender || "밝히지 않음");
  const [age, setAge] = useState(profile.age || "");
  const [job, setJob] = useState(profile.job || "");
  const [info, setInfo] = useState(profile.info || "");
  const [habit, setHabit] = useState(profile.habit || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile.name || "");
    setAvatar(profile.avatar || "/imgdefault.jpg");
    setGender(profile.gender || "밝히지 않음");
    setAge(profile.age || "");
    setJob(profile.job || "");
    setInfo(profile.info || "");
    setHabit(profile.habit || "");
    setIsEdit(editMode);
  }, [profile, editMode]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const payload = { 
      name, 
      avatar, 
      gender, 
      age: age && !isNaN(Number(age)) ? Number(age) : null, 
      job, 
      info, 
      habit 
    };
    const res = await fetch(`/api/persona/${profile.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      setIsEdit(false);
      if (onSave) onSave();
      onClose();
    } else {
      alert("수정 실패: " + data.error);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 430,
        position: 'relative',
        minHeight: 520
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            background: 'none',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
        {/* 프로필 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
              src={profile.avatar || "/imgdefault.jpg"}
            alt={profile.name}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }}
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/imgdefault.jpg'; }}
          />
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 2 }}>{profile.name}</div>
              <div style={{ color: '#888', fontSize: 15 }}>
                팔로워 <b>{followerCount}</b> &nbsp; 팔로잉 <b>{followingCount}</b>
              </div>
            </div>
          </div>
          {/* 내 페이지가 아니면 팔로우 버튼 노출 */}
          {!isMe && (
            <button style={{ background: '#ffe3ef', color: '#ff4081', border: 'none', borderRadius: 16, padding: '10px 36px', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>팔로우</button>
          )}
        </div>
        {/* 자기소개 */}
        <div style={{ color: '#bbb', fontSize: 16, margin: '12px 0 18px 0' }}>{profile.info || '자기 소개가 없습니다.'}</div>
        {/* 공개 캐릭터 리스트 */}
        <div style={{ fontWeight: 700, fontSize: 17, margin: '18px 0 10px 0' }}>공개 캐릭터</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {characters.length === 0 ? (
            <div style={{ color: '#bbb', gridColumn: '1/3' }}>아직 만든 캐릭터가 없습니다.</div>
          ) : (
            characters.map(char => (
              <div key={char.id} style={{ background: '#faf9fd', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 0 }}>
                <img src={char.profileImg || '/imgdefault.jpg'} alt={char.name} style={{ width: '100%', height: 110, objectFit: 'cover', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/imgdefault.jpg'; }} />
                <div style={{ padding: '12px 14px 14px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{char.name}</div>
                  <div style={{ color: '#888', fontSize: 14 }}>{char.age ? `${char.age}세` : ''}{char.age && char.job ? ' · ' : ''}{char.job || ''}</div>
            </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 