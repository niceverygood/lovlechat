// 기본 프로필 이미지 경로
export const DEFAULT_PROFILE_IMAGE = "/default_profile.png";

// 프로필 이미지 에러 핸들러
export const handleProfileImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const target = e.currentTarget;
  if (!target.src.endsWith(DEFAULT_PROFILE_IMAGE)) {
    target.onerror = null;
    target.src = DEFAULT_PROFILE_IMAGE;
  }
}; 