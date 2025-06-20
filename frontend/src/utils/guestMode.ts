export interface GuestLimits {
  maxChatMessages: number;
  maxCharactersToView: number;
  canCreateCharacter: boolean;
  canUseHearts: boolean;
  canRefreshCharacters: boolean;
}

// 게스트 모드 제한사항
export const GUEST_LIMITS: GuestLimits = {
  maxChatMessages: 10, // 채팅당 최대 10메시지
  maxCharactersToView: 3, // 최대 3개 캐릭터만 체험
  canCreateCharacter: false,
  canUseHearts: false,
  canRefreshCharacters: false,
};

// 게스트 모드 확인
export const isGuestMode = (): boolean => {
  return localStorage.getItem('userMode') === 'guest';
};

// 게스트 모드 설정
export const setGuestMode = (): void => {
  console.log('🎭 게스트 모드 자동 설정됨');
  localStorage.setItem('userMode', 'guest');
  localStorage.setItem('guestChatCount', '0');
  localStorage.setItem('guestViewedCharacters', JSON.stringify([]));
  console.log('✅ 게스트 모드 설정 완료:', localStorage.getItem('userMode'));
};

// 게스트 모드 해제
export const clearGuestMode = (): void => {
  localStorage.removeItem('userMode');
  localStorage.removeItem('guestChatCount');
  localStorage.removeItem('guestViewedCharacters');
};

// 게스트 채팅 횟수 관리
export const getGuestChatCount = (): number => {
  const count = localStorage.getItem('guestChatCount');
  return count ? parseInt(count, 10) : 0;
};

export const incrementGuestChatCount = (): void => {
  const current = getGuestChatCount();
  localStorage.setItem('guestChatCount', (current + 1).toString());
};

export const canGuestChat = (): boolean => {
  return getGuestChatCount() < GUEST_LIMITS.maxChatMessages;
};

// 게스트 캐릭터 조회 관리
export const getGuestViewedCharacters = (): number[] => {
  const viewed = localStorage.getItem('guestViewedCharacters');
  return viewed ? JSON.parse(viewed) : [];
};

export const addGuestViewedCharacter = (characterId: number): void => {
  const viewed = getGuestViewedCharacters();
  if (!viewed.includes(characterId)) {
    viewed.push(characterId);
    localStorage.setItem('guestViewedCharacters', JSON.stringify(viewed));
  }
};

export const canGuestViewCharacter = (characterId: number): boolean => {
  const viewed = getGuestViewedCharacters();
  return viewed.includes(characterId) || viewed.length < GUEST_LIMITS.maxCharactersToView;
};

// 게스트 모드 알림 메시지
export const getGuestLimitMessage = (type: 'chat' | 'character' | 'feature'): string => {
  switch (type) {
    case 'chat':
      return `게스트는 최대 ${GUEST_LIMITS.maxChatMessages}개의 메시지만 보낼 수 있습니다. 더 많은 대화를 원한다면 로그인해주세요!`;
    case 'character':
      return `게스트는 최대 ${GUEST_LIMITS.maxCharactersToView}개의 캐릭터만 체험할 수 있습니다. 모든 캐릭터를 만나려면 로그인해주세요!`;
    case 'feature':
      return '이 기능은 로그인 후 이용할 수 있습니다. 지금 로그인하고 모든 기능을 체험해보세요!';
    default:
      return '로그인하고 더 많은 기능을 이용해보세요!';
  }
}; 