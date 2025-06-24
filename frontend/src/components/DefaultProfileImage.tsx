import { DEFAULT_PROFILE_IMAGE, handleProfileImageError } from '../utils/constants';

export default function DefaultProfileImage() {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1F1B24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <img
        src={DEFAULT_PROFILE_IMAGE}
        alt="기본 프로필"
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        onError={(e) => {
          // 이미지 로드 실패 시 SVG 아이콘으로 대체
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="60" height="60" viewBox="0 0 24 24"
                style="display:block;margin:auto;border-radius:50%;background:#1F1B24;"
                fill="none"
                stroke="#8A6EFF"
                stroke-width="1.5"
              >
                <circle cx="12" cy="9" r="3" />
                <path d="M12 14c-4 0-8 2-8 4v1h16v-1c0-2-4-4-8-4z" />
              </svg>
            `;
          }
        }}
      />
    </div>
  );
} 