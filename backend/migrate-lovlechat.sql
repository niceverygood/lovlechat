-- LovleChat DB 마이그레이션 스크립트
-- 기존 lovlechat 데이터베이스에 안전하게 컬럼/테이블 추가

USE lovlechat;

-- 기존 테이블들의 필수 컬럼 확인 및 추가 (IF NOT EXISTS 방식)

-- 1. users 테이블 컬럼 확인 및 추가
-- hearts 컬럼이 없으면 추가
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'lovlechat' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'hearts') = 0,
    'ALTER TABLE users ADD COLUMN hearts INT DEFAULT 100 COMMENT "보유 하트 수";',
    'SELECT "hearts 컬럼 이미 존재함" as status;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- lastHeartUpdate 컬럼이 없으면 추가
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'lovlechat' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lastHeartUpdate') = 0,
    'ALTER TABLE users ADD COLUMN lastHeartUpdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT "마지막 하트 업데이트";',
    'SELECT "lastHeartUpdate 컬럼 이미 존재함" as status;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. heart_transactions 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS heart_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '거래 ID',
    userId VARCHAR(100) NOT NULL COMMENT '사용자 ID',
    amount INT NOT NULL COMMENT '사용/충전 하트 수 (음수: 사용, 양수: 충전)',
    type VARCHAR(20) DEFAULT 'chat' COMMENT '거래 유형 (chat, purchase, gift 등)',
    description TEXT COMMENT '거래 설명',
    beforeHearts INT COMMENT '거래 전 하트 수',
    afterHearts INT COMMENT '거래 후 하트 수',
    relatedId VARCHAR(100) COMMENT '관련 ID (채팅방, 캐릭터 등)',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시간',
    INDEX idx_userId (userId),
    INDEX idx_createdAt (createdAt)
) COMMENT='하트 거래 내역';

-- 3. character_profiles 테이블에 firstScene, firstMessage 컬럼 추가
-- firstScene 컬럼이 없으면 추가
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'lovlechat' AND TABLE_NAME = 'character_profiles' AND COLUMN_NAME = 'firstScene') = 0,
    'ALTER TABLE character_profiles ADD COLUMN firstScene TEXT COMMENT "첫 만남 장면";',
    'SELECT "firstScene 컬럼 이미 존재함" as status;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- firstMessage 컬럼이 없으면 추가
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'lovlechat' AND TABLE_NAME = 'character_profiles' AND COLUMN_NAME = 'firstMessage') = 0,
    'ALTER TABLE character_profiles ADD COLUMN firstMessage TEXT COMMENT "첫 대사";',
    'SELECT "firstMessage 컬럼 이미 존재함" as status;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. character_profiles 테이블에 backgroundImg 컬럼 추가
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'lovlechat' AND TABLE_NAME = 'character_profiles' AND COLUMN_NAME = 'backgroundImg') = 0,
    'ALTER TABLE character_profiles ADD COLUMN backgroundImg TEXT COMMENT "배경 이미지 URL";',
    'SELECT "backgroundImg 컬럼 이미 존재함" as status;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. 필요한 인덱스 추가 (이미 있으면 에러 무시)
-- 인덱스는 이미 테이블 생성시 추가되어 있으므로 스킵

-- 6. 실제 사용자 하트 35개 데이터 확인 및 업데이트
INSERT INTO users (userId, hearts, email, displayName) VALUES 
('3wsQZRxOv9OjKHFGNYfvWuTZGCJ2', 35, 'user@example.com', '실제 사용자')
ON DUPLICATE KEY UPDATE hearts = 35;

-- 7. 하트 거래 내역 데이터 확인 및 추가
INSERT INTO heart_transactions (userId, amount, type, description, beforeHearts, afterHearts) VALUES
('3wsQZRxOv9OjKHFGNYfvWuTZGCJ2', -65, 'chat', '채팅 메시지 전송으로 하트 사용', 100, 35)
ON DUPLICATE KEY UPDATE amount = VALUES(amount);

-- 마이그레이션 완료 상태 확인
SELECT 
    'lovlechat DB 마이그레이션 완료!' as status,
    (SELECT COUNT(*) FROM users WHERE hearts = 35) as users_with_35_hearts,
    (SELECT COUNT(*) FROM heart_transactions) as total_transactions,
    NOW() as migration_time; 