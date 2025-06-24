const { executeQuery, executeMutation } = require('./db');

/**
 * 호감도 알고리즘 계산기
 * 
 * 호감도 변화 요인:
 * - 메시지 길이 (긴 메시지일수록 관심도 높음)
 * - 대화 빈도 (연속 대화일수록 보너스)
 * - 시간대 (적절한 시간대 보너스)
 * - 특별한 키워드 (긍정적/부정적 단어)
 * - 대화 지속성 (며칠간 꾸준히 대화)
 */

// 호감도 단계 정의
const FAVOR_STAGES = [
  { label: "아는사이", min: 0, max: 19 },
  { label: "친구", min: 20, max: 49 },
  { label: "썸", min: 50, max: 399 },
  { label: "연인", min: 400, max: 3999 },
  { label: "결혼", min: 4000, max: 999999 }
];

// 긍정적 키워드들
const POSITIVE_KEYWORDS = [
  '좋아', '사랑', '행복', '재미', '웃음', '고마워', '감사', '최고', '훌륭', '멋져',
  '예쁘', '귀여', '착해', '친절', '따뜻', '달콤', '소중', '특별', '완벽', '대단',
  '좋은', '훌륭한', '멋진', '아름다운', '즐거운', '기쁜', '행복한', '만족', '흥미로운'
];

// 부정적 키워드들
const NEGATIVE_KEYWORDS = [
  '싫어', '미워', '짜증', '화나', '실망', '슬픈', '아픈', '힘들', '괴로', '답답',
  '지겨', '귀찮', '무서', '두려', '걱정', '불안', '스트레스', '피곤', '지친'
];

// 호감도 관련 키워드들 (채팅에서 제거해야 할 키워드)
const FAVOR_RELATED_KEYWORDS = [
  '호감도', '점수', '관계', '친밀도', '애정', '사랑', '좋아함', '싫어함',
  'favor', 'score', 'relationship', 'intimacy', 'love', 'like', 'dislike',
  '호감', '감정', '느낌', '마음', '기분', '상태'
];

/**
 * 호감도 관련 키워드를 채팅 내용에서 제거
 * @param {string} message 원본 메시지
 * @returns {string} 필터링된 메시지
 */
function filterFavorKeywords(message) {
  let filteredMessage = message;
  
  // 호감도 관련 키워드 제거
  FAVOR_RELATED_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    filteredMessage = filteredMessage.replace(regex, '');
  });
  
  // 연속된 공백 정리
  filteredMessage = filteredMessage.replace(/\s+/g, ' ').trim();
  
  return filteredMessage;
}

/**
 * 메시지 기반 호감도 증감 계산
 */
function calculateFavorChange(userMessage, messageCount, isConsecutive, timeOfDay) {
  let favorChange = 0;
  
  // 호감도 관련 키워드 필터링 (계산용으로는 원본 사용)
  const originalMessage = userMessage;
  
  // 1. 기본 메시지 점수 (1-3점)
  favorChange += Math.min(3, Math.max(1, Math.floor(originalMessage.length / 10)));
  
  // 2. 메시지 길이 보너스
  if (originalMessage.length > 50) {
    favorChange += 2; // 긴 메시지 보너스
  }
  if (originalMessage.length > 100) {
    favorChange += 3; // 매우 긴 메시지 추가 보너스
  }
  
  // 3. 연속 대화 보너스
  if (isConsecutive) {
    favorChange += Math.min(5, Math.floor(messageCount / 5)); // 5개 메시지마다 1점씩 보너스
  }
  
  // 4. 시간대 보너스 (9시-23시가 적절한 시간)
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 23) {
    favorChange += 1;
  }
  
  // 5. 키워드 분석
  const positiveCount = POSITIVE_KEYWORDS.filter(keyword => 
    originalMessage.toLowerCase().includes(keyword)
  ).length;
  const negativeCount = NEGATIVE_KEYWORDS.filter(keyword => 
    originalMessage.toLowerCase().includes(keyword)
  ).length;
  
  favorChange += positiveCount * 2; // 긍정 키워드당 +2점
  favorChange -= negativeCount * 1; // 부정 키워드당 -1점
  
  // 6. 질문 보너스 (상대방에게 관심을 보이는 행동)
  if (originalMessage.includes('?') || originalMessage.includes('？')) {
    favorChange += 1;
  }
  
  // 7. 이모티콘 보너스 (더 간단하고 안전한 방식)
  // 이모지는 단순히 특정 패턴으로 감지
  const emojiPatterns = [
    /😀|😁|😂|🤣|😃|😄|😅|😆|😉|😊|😋|😎|😍|😘|🥰|😗|😙|😚|☺️|🙂|🤗|🤩|🤔|🤨|😐|😑|😶|🙄|😏|😣|😥|😮|🤐|😯|😪|😫|😴|😌|😛|😜|😝|🤤|😒|😓|😔|😕|🙃|🤑|😲|☹️|🙁|😖|😞|😟|😤|😢|😭|😦|😧|😨|😩|🤯|😬|😰|😱|🥵|🥶|😳|🤪|😵|😡|😠|🤬|😷|🤒|🤕|🤢|🤮|🤧|😇|🤠|🤡|🥳|🥴|🥺|🤥|🤫|🤭|🧐|🤓|😈|👿|👹|👺|💀|👻|👽|🤖|💩|😺|😸|😹|😻|😼|😽|🙀|😿|😾/g,
    /❤️|🧡|💛|💚|💙|💜|🖤|🤍|🤎|💕|💞|💓|💗|💖|💘|💝|💟|❣️|💔|❤️‍🔥|❤️‍🩹/g,
    /👍|👎|👌|✌️|🤞|🤟|🤘|🤙|👈|👉|👆|👇|☝️|✋|🤚|🖐️|🖖|👋|🤏|💪|🦾|🖕|✍️|🙏|🦶|🦵|👂|🦻|👃|🧠|🫀|🫁|🦷|🦴|👀|👁️|👅|👄|💋|🩸/g
  ];
  
  let emojiCount = 0;
  emojiPatterns.forEach(pattern => {
    const matches = originalMessage.match(pattern);
    if (matches) emojiCount += matches.length;
  });
  
  favorChange += Math.min(3, emojiCount); // 이모티콘 최대 3점
  
  // 최소/최대 제한
  return Math.max(-5, Math.min(15, favorChange));
}

/**
 * 호감도 조회 (없으면 기본값 0으로 생성)
 */
async function getFavor(personaId, characterId) {
  try {
    // 기존 호감도 조회
    const existing = await executeQuery(
      'SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?',
      [personaId, characterId]
    );
    
    if (existing.length > 0) {
      return existing[0].favor;
    }
    
    // 없으면 기본값 0으로 생성
    await executeMutation(
      'INSERT INTO character_favors (personaId, characterId, favor) VALUES (?, ?, 0)',
      [personaId, characterId]
    );
    
    return 0;
  } catch (error) {
    console.error('호감도 조회 에러:', error);
    return 0;
  }
}

/**
 * 호감도 업데이트
 */
async function updateFavor(personaId, characterId, newFavor) {
  try {
    await executeMutation(
      `INSERT INTO character_favors (personaId, characterId, favor) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE favor = ?`,
      [personaId, characterId, newFavor, newFavor]
    );
    
    return true;
  } catch (error) {
    console.error('호감도 업데이트 에러:', error);
    return false;
  }
}

/**
 * 대화 연속성 체크
 */
async function checkConsecutiveMessages(personaId, characterId) {
  try {
    const recentMessages = await executeQuery(
      `SELECT createdAt FROM chats 
       WHERE personaId = ? AND characterId = ? AND sender = 'user'
       ORDER BY createdAt DESC LIMIT 10`,
      [personaId, characterId]
    );
    
    if (recentMessages.length < 2) return { isConsecutive: false, count: recentMessages.length };
    
    // 최근 24시간 내 메시지들 체크
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentCount = recentMessages.filter(msg => 
      new Date(msg.createdAt) > oneDayAgo
    ).length;
    
    return {
      isConsecutive: recentCount >= 3, // 24시간 내 3개 이상 메시지면 연속 대화
      count: recentCount
    };
  } catch (error) {
    console.error('연속 메시지 체크 에러:', error);
    return { isConsecutive: false, count: 0 };
  }
}

/**
 * 메인 호감도 처리 함수
 */
async function processFavorChange(personaId, characterId, userMessage) {
  try {
    console.log('🎯 호감도 처리 시작:', { personaId, characterId, userMessage });
    
    // 게스트 모드는 호감도 처리 안함
    if (personaId === 'guest') {
      console.log('🚫 게스트 모드 - 호감도 처리 건너뜀');
      return { currentFavor: 0, favorChange: 0 };
    }
    
    // 현재 호감도 조회
    const currentFavor = await getFavor(personaId, characterId);
    console.log('📊 현재 호감도:', currentFavor);
    
    // 대화 연속성 체크
    const { isConsecutive, count } = await checkConsecutiveMessages(personaId, characterId);
    console.log('🔄 대화 연속성:', { isConsecutive, count });
    
    // 현재 시간
    const timeOfDay = new Date().getHours();
    console.log('⏰ 현재 시간:', timeOfDay);
    
    // 호감도 변화 계산
    const favorChange = calculateFavorChange(userMessage, count, isConsecutive, timeOfDay);
    console.log('⚡ 계산된 호감도 변화:', favorChange);
    
    // 새로운 호감도 (음수 방지)
    const newFavor = Math.max(0, currentFavor + favorChange);
    console.log('📈 새로운 호감도:', newFavor);
    
    // 호감도 업데이트
    const updateSuccess = await updateFavor(personaId, characterId, newFavor);
    console.log('💾 호감도 업데이트 결과:', updateSuccess);
    
    console.log(`🎯 호감도 변화: ${currentFavor} → ${newFavor} (${favorChange > 0 ? '+' : ''}${favorChange})`);
    console.log(`📊 계산 요소: 메시지길이=${userMessage.length}, 연속대화=${isConsecutive}, 메시지수=${count}, 시간=${timeOfDay}시`);
    
    return {
      currentFavor: newFavor,
      favorChange: favorChange,
      previousFavor: currentFavor
    };
  } catch (error) {
    console.error('❌ 호감도 처리 에러:', error);
    return { currentFavor: 0, favorChange: 0 };
  }
}

module.exports = {
  processFavorChange,
  getFavor,
  updateFavor,
  FAVOR_STAGES,
  calculateFavorChange,
  filterFavorKeywords
}; 