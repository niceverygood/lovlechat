import React, { useState, useEffect } from 'react';
import CustomAlert from './CustomAlert';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: {
    id: string;
    name: string;
    gender: string;
    age: number;
    job: string;
    info: string;
    habit: string;
    avatar: string;
  };
  onSave: (updatedProfile: any) => void;
  mode?: 'edit' | 'create';
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  profileData,
  onSave,
  mode = 'edit'
}) => {
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    age: '',
    job: '',
    info: '',
    habit: '',
    avatar: ''
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: profileData.name || '',
        gender: profileData.gender || '',
        age: profileData.age?.toString() || '',
        job: profileData.job || '',
        info: profileData.info || '',
        habit: profileData.habit || '',
        avatar: profileData.avatar || '/imgdefault.jpg'
      });
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileImgClick = () => fileInputRef.current?.click();
  const handleProfileImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFormData(prev => ({ ...prev, avatar: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setAlertTitle('입력 오류');
      setAlertMsg('이름은 필수 입력 항목입니다.');
      setAlertOpen(true);
      return;
    }

    setLoading(true);
    try {
      const updatedProfile = {
        ...profileData,
        name: formData.name,
        gender: formData.gender,
        age: formData.age && !isNaN(Number(formData.age)) ? Number(formData.age) : null,
        job: formData.job,
        info: formData.info,
        habit: formData.habit,
        avatar: formData.avatar
      };

      await onSave(updatedProfile);
      onClose();
    } catch (error) {
      console.error('프로필 수정 중 오류:', error);
      setAlertTitle('오류');
      setAlertMsg('프로필 수정 중 오류가 발생했습니다.');
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3000
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-card)',
        borderRadius: 16,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90vh',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid #333'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>{mode === 'create' ? '프로필 생성' : '프로필 수정'}</h2>
          <button style={{
            background: 'none',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: '#6b7280',
            padding: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8
          }} onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <img
                src={formData.avatar || '/imgdefault.jpg'}
                alt="프로필"
                style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', background: '#eee' }}
                onError={e => {
                  if (!e.currentTarget.src.endsWith('/imgdefault.jpg')) {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/imgdefault.jpg';
                  }
                }}
              />
              <button
                onClick={handleProfileImgClick}
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
                  fontSize: 22,
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
                onChange={handleProfileImgChange}
              />
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="name" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="이름을 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="gender" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>성별</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">선택하세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="age" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>나이</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                placeholder="숫자만 입력해 주세요"
                min="1"
                max="100"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="job" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>직업</label>
              <input
                type="text"
                id="job"
                name="job"
                value={formData.job}
                onChange={handleInputChange}
                placeholder="직업을 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="info" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>기본 정보</label>
              <textarea
                id="info"
                name="info"
                value={formData.info}
                onChange={handleInputChange}
                placeholder="기본 정보를 입력하세요"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 80
                }}
              />
            </div>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <label htmlFor="habit" style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#fff', fontSize: 14 }}>습관적인 말과 행동</label>
              <textarea
                id="habit"
                name="habit"
                value={formData.habit}
                onChange={handleInputChange}
                placeholder="습관적인 말과 행동을 입력하세요"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #444',
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#333',
                  color: '#fff',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 80
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 12,
              marginTop: 32,
              paddingTop: 20,
              borderTop: '1px solid #333',
              width: '100%',
            }}>
              <button type="button" onClick={onClose} style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid #444',
                background: '#333',
                color: '#fff',
                minWidth: 0
              }}>
                취소
              </button>
              <button type="submit" disabled={loading} style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                background: loading ? '#ccc' : '#ff4081',
                color: '#fff',
                minWidth: 0,
                marginTop: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}>
                {loading && (
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2px solid #fff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
      <CustomAlert open={alertOpen} title={alertTitle} message={alertMsg} onConfirm={() => setAlertOpen(false)} />
      <style>{`
        /* 스크롤바 숨김 */
        .ProfileEditModal::-webkit-scrollbar {
          display: none;
        }
        /* number input 스피너 숨김 */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        /* 로딩 스피너 애니메이션 */
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProfileEditModal; 