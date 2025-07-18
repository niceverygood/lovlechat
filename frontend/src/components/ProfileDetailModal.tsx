import React from 'react';
import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';

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

interface ProfileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: {
    id: string;
    name: string;
    avatar: string;
    gender?: string;
    age?: string;
    job?: string;
    info?: string;
    habit?: string;
  };
  profileData?: Persona;
  editMode?: boolean;
  onSave?: () => void;
  isMe?: boolean;
}

export default function ProfileDetailModal({ isOpen, onClose, profile, profileData, isMe = false }: ProfileDetailModalProps) {
  if (!isOpen) return null;
  
  // profileData가 전달되면 우선 사용, 없으면 profile 사용
  const displayProfile = profileData || profile;
  
  if (!displayProfile) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 350,
        position: 'relative',
        border: '1px solid #333'
      }}>
        {/* 닫기 버튼 */}
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
            color: '#888',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>

        {/* 프로필 이미지 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: 16 
        }}>
          <img
            src={displayProfile.avatar || DEFAULT_PROFILE_IMAGE}
            alt={displayProfile.name}
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '3px solid #333' 
            }}
            onError={handleProfileImageError}
          />
        </div>

        {/* 이름 */}
        <div style={{ 
          color: '#fff', 
          fontSize: 22, 
          fontWeight: 700, 
          textAlign: 'center',
          marginBottom: 8
        }}>
          {displayProfile.name}
        </div>

        {/* 기본 정보 (나이, 성별, 직업) */}
        <div style={{ 
          color: '#aaa', 
          fontSize: 16, 
          textAlign: 'center',
          marginBottom: 16
        }}>
          {[
            displayProfile.age && `${displayProfile.age}살`,
            displayProfile.gender,
            displayProfile.job
          ].filter(Boolean).join(' · ') || '정보 없음'}
        </div>

        {/* 추가 정보 */}
        {displayProfile.info && (
          <div style={{ 
            color: '#ccc', 
            fontSize: 14, 
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 1.4,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {displayProfile.info}
          </div>
        )}

        {/* 습관 정보 */}
        {displayProfile.habit && (
          <div style={{ 
            color: '#ddd', 
            fontSize: 14, 
            textAlign: 'center',
            lineHeight: 1.4,
            padding: '12px 16px',
            background: 'rgba(108, 92, 231, 0.1)',
            borderRadius: 12,
            border: '1px solid rgba(108, 92, 231, 0.3)'
          }}>
            <div style={{ color: '#9c88ff', fontWeight: 600, marginBottom: 4 }}>특징</div>
            {displayProfile.habit}
          </div>
        )}
      </div>
    </div>
  );
} 