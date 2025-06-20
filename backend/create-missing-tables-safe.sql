-- 안전한 하트 시스템 테이블 생성 (외래키 없이)
-- 실행 방법: mysql -u root -p lovlechat < create-missing-tables-safe.sql

-- 1. 사용자 테이블 (하트 시스템)
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

-- 2. 하트 사용 내역 테이블 (외래키 없이)
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
  INDEX idx_hearts_user_time (userId, createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='하트 사용/구매 내역';

-- 3. 샘플 사용자 생성 (테스트용)
INSERT IGNORE INTO users (userId, hearts, email, displayName) VALUES 
('3wsQZRJFf1R2z13YPpF4p1rlri02', 100, 'test@example.com', '테스트 유저1'),
('test_user_1', 100, 'test1@example.com', '테스트 유저2');

-- 완료 메시지
SELECT '✅ 하트 시스템 테이블 생성 완료! (외래키 없이 안전하게)' as result; 