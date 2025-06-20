-- ====================================
-- 🚀 LovleChat 데이터베이스 스키마
-- ====================================
-- 
-- 배포 시 이 스크립트를 실행하여 테이블을 생성하세요.
-- MySQL 8.0+ 호환

-- 데이터베이스 생성 (필요한 경우)
-- CREATE DATABASE IF NOT EXISTS lovlechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE lovlechat;

-- ====================================
-- 1. 사용자 테이블 (하트 시스템)
-- ====================================
CREATE TABLE IF NOT EXISTS users (
  userId VARCHAR(100) PRIMARY KEY COMMENT 'Firebase 사용자 ID',
  hearts INT DEFAULT 100 COMMENT '보유 하트 수',
  email VARCHAR(255) COMMENT '사용자 이메일',
  displayName VARCHAR(100) COMMENT '사용자 닉네임',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입 시각',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
  lastHeartUpdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '마지막 하트 변경 시각',
  
  INDEX idx_hearts (hearts),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 정보 및 하트 관리';

-- ====================================
-- 2. 페르소나 테이블 (사용자 캐릭터)
-- ====================================
CREATE TABLE IF NOT EXISTS personas (
  id VARCHAR(50) PRIMARY KEY COMMENT '페르소나 고유 ID (persona_timestamp_randomstring)',
  userId VARCHAR(100) NOT NULL COMMENT 'Firebase 사용자 ID',
  name VARCHAR(50) NOT NULL COMMENT '페르소나 이름',
  avatar TEXT COMMENT '아바타 이미지 URL',
  gender VARCHAR(10) COMMENT '성별 (남성/여성/기타)',
  age VARCHAR(10) COMMENT '나이',
  job VARCHAR(50) COMMENT '직업',
  info TEXT COMMENT '추가 정보/자기소개',
  habit TEXT COMMENT '습관/특징',
  personality TEXT COMMENT '성격',
  interests TEXT COMMENT '관심사',
  background TEXT COMMENT '배경/설정',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각',
  
  INDEX idx_userId (userId),
  INDEX idx_createdAt (createdAt),
  
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 페르소나 정보';

-- ====================================
-- 3. 캐릭터 프로필 테이블 (AI 캐릭터)
-- ====================================
CREATE TABLE IF NOT EXISTS character_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '캐릭터 고유 ID',
  userId VARCHAR(100) COMMENT '생성자 사용자 ID',
  profileImg TEXT COMMENT '프로필 이미지 URL',
  name VARCHAR(50) NOT NULL COMMENT '캐릭터 이름',
  age VARCHAR(10) COMMENT '나이',
  job VARCHAR(50) COMMENT '직업',
  oneLiner TEXT COMMENT '한줄 소개',
  background TEXT COMMENT '배경 설정',
  personality TEXT COMMENT '성격',
  habit TEXT COMMENT '습관/특징',
  likes TEXT COMMENT '좋아하는 것',
  dislikes TEXT COMMENT '싫어하는 것',
  extraInfos TEXT COMMENT '추가 정보',
  gender VARCHAR(10) COMMENT '성별',
  scope VARCHAR(10) DEFAULT '공개' COMMENT '공개 범위 (공개/비공개)',
  roomCode VARCHAR(20) COMMENT '방 코드',
  category VARCHAR(20) COMMENT '카테고리',
  tags TEXT COMMENT '태그 (JSON 배열)',
  attachments TEXT COMMENT '첨부파일 (JSON 배열)',
  firstScene TEXT COMMENT '첫 만남 장면',
  firstMessage TEXT COMMENT '첫 메시지',
  backgroundImg TEXT COMMENT '배경 이미지 URL',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
  
  INDEX idx_userId (userId),
  INDEX idx_scope (scope),
  INDEX idx_category (category),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 캐릭터 프로필 정보';

-- ====================================
-- 4. 채팅 메시지 테이블
-- ====================================
CREATE TABLE IF NOT EXISTS chats (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '메시지 고유 ID',
  personaId VARCHAR(50) NOT NULL COMMENT '페르소나 ID',
  characterId INT NOT NULL COMMENT '캐릭터 ID',
  message TEXT NOT NULL COMMENT '메시지 내용',
  sender ENUM('user', 'ai') NOT NULL COMMENT '발신자 타입',
  characterName VARCHAR(50) COMMENT '캐릭터 이름 (캐시)',
  characterProfileImg TEXT COMMENT '캐릭터 프로필 이미지 (캐시)',
  characterAge VARCHAR(10) COMMENT '캐릭터 나이 (캐시)',
  characterJob VARCHAR(50) COMMENT '캐릭터 직업 (캐시)',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각',
  
  INDEX idx_persona_character (personaId, characterId),
  INDEX idx_personaId (personaId),
  INDEX idx_characterId (characterId),
  INDEX idx_createdAt (createdAt),
  INDEX idx_sender (sender),
  
  FOREIGN KEY (personaId) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (characterId) REFERENCES character_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='채팅 메시지 저장';

-- ====================================
-- 5. 호감도 테이블
-- ====================================
CREATE TABLE IF NOT EXISTS character_favors (
  personaId VARCHAR(50) NOT NULL COMMENT '페르소나 ID',
  characterId INT NOT NULL COMMENT '캐릭터 ID',
  favor INT DEFAULT 0 COMMENT '호감도 (0-100)',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
  
  PRIMARY KEY (personaId, characterId),
  INDEX idx_favor (favor),
  
  FOREIGN KEY (personaId) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (characterId) REFERENCES character_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='페르소나-캐릭터 호감도';

-- ====================================
-- 6. 캐릭터 숨김 처리 테이블
-- ====================================
CREATE TABLE IF NOT EXISTS character_hidden (
  userId VARCHAR(100) NOT NULL COMMENT '사용자 ID',
  characterId INT NOT NULL COMMENT '캐릭터 ID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '숨김 처리 시각',
  
  PRIMARY KEY (userId, characterId),
  INDEX idx_userId (userId),
  
  FOREIGN KEY (characterId) REFERENCES character_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자별 캐릭터 숨김 처리';

-- ====================================
-- 7. 하트 사용 내역 테이블
-- ====================================
CREATE TABLE IF NOT EXISTS heart_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '거래 고유 ID',
  userId VARCHAR(100) NOT NULL COMMENT '사용자 ID',
  amount INT NOT NULL COMMENT '하트 변동량 (+구매, -사용)',
  type ENUM('purchase', 'chat', 'daily_bonus', 'admin') NOT NULL COMMENT '거래 유형',
  description VARCHAR(255) COMMENT '거래 설명',
  beforeHearts INT NOT NULL COMMENT '거래 전 하트 수',
  afterHearts INT NOT NULL COMMENT '거래 후 하트 수',
  relatedId VARCHAR(100) COMMENT '관련 ID (채팅의 경우 personaId_characterId)',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시각',
  
  INDEX idx_userId (userId),
  INDEX idx_type (type),
  INDEX idx_createdAt (createdAt),
  
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='하트 사용/구매 내역';

-- ====================================
-- 🎯 샘플 데이터 (선택사항)
-- ====================================

-- 샘플 사용자 (테스트용)
INSERT IGNORE INTO users (
  userId, hearts, email, displayName
) VALUES (
  'test_user_1', 
  100, 
  'test@example.com', 
  '테스트 유저'
);

-- 샘플 캐릭터 (공개용)
INSERT IGNORE INTO character_profiles (
  id, name, age, job, oneLiner, personality, firstMessage, scope, category
) VALUES (
  1, 
  '아이유', 
  '30', 
  '가수', 
  '따뜻한 목소리의 국민 여동생',
  '밝고 긍정적이며 친근한 성격. 음악을 사랑하고 팬들을 아끼는 마음이 깊다.',
  '안녕하세요! 만나서 반가워요~ 오늘 하루는 어떠셨나요?',
  '공개',
  '연예인'
);

-- ====================================
-- 📊 성능 최적화
-- ====================================

-- 자주 사용되는 쿼리 최적화를 위한 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_chats_recent ON chats(personaId, characterId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_personas_user_recent ON personas(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_characters_public ON character_profiles(scope, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_hearts_user_time ON heart_transactions(userId, createdAt DESC);

-- ====================================
-- ✅ 설치 완료
-- ====================================
-- 
-- 스키마 생성이 완료되었습니다!
-- 
-- 다음 단계:
-- 1. 환경변수 설정 확인
-- 2. 애플리케이션 배포
-- 3. /api/test-db 엔드포인트로 연결 테스트
-- 4. 첫 페르소나 및 캐릭터 생성
-- 
-- 문제가 있다면:
-- - 문자셋이 utf8mb4인지 확인
-- - 외래키 제약조건 확인
-- - 인덱스 생성 확인 -- 결제 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  imp_uid VARCHAR(255) NOT NULL UNIQUE COMMENT '아임포트 결제 고유ID',
  merchant_uid VARCHAR(255) NOT NULL COMMENT '가맹점 주문번호',
  userId VARCHAR(255) NOT NULL COMMENT '사용자 ID',
  amount INT NOT NULL COMMENT '결제 금액',
  heartCount INT NOT NULL COMMENT '구매한 하트 개수',
  status VARCHAR(50) NOT NULL DEFAULT 'completed' COMMENT '결제 상태',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '결제 시간',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시간',
  
  INDEX idx_user_id (userId),
  INDEX idx_imp_uid (imp_uid),
  INDEX idx_merchant_uid (merchant_uid),
  INDEX idx_created_at (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='결제 기록 테이블'; 