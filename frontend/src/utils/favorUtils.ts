export interface FavorStage {
  label: string;
  color: string;
  min: number;
  max: number;
}

export const FAVOR_STAGES: FavorStage[] = [
  { label: '아는사이', color: '#8B5CF6', min: 0, max: 19 },
  { label: '친구', color: '#06B6D4', min: 20, max: 49 },
  { label: '썸', color: '#F59E0B', min: 50, max: 399 },
  { label: '연인', color: '#EC4899', min: 400, max: 3999 },
  { label: '결혼', color: '#EF4444', min: 4000, max: 999999 }
];

/**
 * 호감도 점수에 따른 단계를 반환합니다.
 * @param favor 호감도 점수
 * @returns 해당하는 호감도 단계 정보
 */
export const getFavorStage = (favor: number): FavorStage => {
  const stage = FAVOR_STAGES.find(s => favor >= s.min && favor <= s.max);
  return stage || FAVOR_STAGES[0]; // 기본값은 '아는사이'
};

/**
 * 호감도 변화에 따른 이모지를 반환합니다.
 * @param favorChange 호감도 변화량
 * @returns 해당하는 이모지
 */
export const getFavorEmoji = (favorChange: number): string => {
  return favorChange > 0 ? '💕' : '💔';
};

/**
 * 호감도 변화 텍스트를 포맷팅합니다.
 * @param favorChange 호감도 변화량
 * @returns 포맷팅된 텍스트
 */
export const formatFavorChange = (favorChange: number): string => {
  return favorChange > 0 ? `+${favorChange}` : `${favorChange}`;
}; 