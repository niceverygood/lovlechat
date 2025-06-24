-- ============================================
-- LovleChat 데이터베이스 성능 분석 및 최적화
-- ============================================

-- 1. 현재 주요 쿼리들의 실행 계획 분석
-- ============================================

-- 1-1. Hearts 관련 쿼리 분석
EXPLAIN SELECT afterHearts FROM heart_transactions WHERE userId = 'test-user' ORDER BY createdAt DESC LIMIT 1;

-- 1-2. Personas 관련 쿼리 분석
EXPLAIN SELECT * FROM personas WHERE userId = 'test-user' ORDER BY createdAt DESC;
EXPLAIN SELECT * FROM personas WHERE id = 'test-persona-id';

-- 1-3. Chats 관련 쿼리 분석 
EXPLAIN SELECT id, sender, message, createdAt FROM chats WHERE personaId = 'test-persona' AND characterId = 1 ORDER BY createdAt ASC LIMIT 50;
EXPLAIN SELECT COUNT(*) as total FROM chats WHERE personaId = 'test-persona' AND characterId = 1;

-- 1-4. Character Favors 관련 쿼리 분석
EXPLAIN SELECT id FROM character_favors WHERE userId = 'test-user' AND characterId = 1;

-- 1-5. Chat List 복잡한 JOIN 쿼리 분석
EXPLAIN SELECT 
  c.characterId,
  c.personaId,
  cp.name,
  cp.profileImg,
  p.name as personaName,
  p.avatar as personaAvatar,
  cm.message as lastMessage,
  c.lastChatTime
FROM (
  SELECT 
    characterId,
    personaId,
    MAX(createdAt) as lastChatTime
  FROM chats
  GROUP BY characterId, personaId
) c
LEFT JOIN character_profiles cp ON c.characterId = cp.id
LEFT JOIN personas p ON c.personaId = p.id
LEFT JOIN chats cm ON c.characterId = cm.characterId 
                   AND c.personaId = cm.personaId 
                   AND c.lastChatTime = cm.createdAt
WHERE p.userId = 'test-user'
ORDER BY c.lastChatTime DESC
LIMIT 20;

-- ============================================
-- 2. 현재 인덱스 상태 확인
-- ============================================

-- 현재 테이블별 인덱스 확인
SHOW INDEX FROM heart_transactions;
SHOW INDEX FROM personas;
SHOW INDEX FROM chats;
SHOW INDEX FROM character_favors;
SHOW INDEX FROM character_profiles;

-- ============================================
-- 3. 성능 최적화 인덱스 추가
-- ============================================

-- 3-1. Heart Transactions 테이블 최적화
-- userId + createdAt 복합 인덱스 (최신 하트 잔액 조회용)
CREATE INDEX IF NOT EXISTS idx_heart_transactions_userid_created 
ON heart_transactions(userId, createdAt DESC);

-- 3-2. Personas 테이블 최적화
-- userId 인덱스 (사용자별 페르소나 목록 조회용)
CREATE INDEX IF NOT EXISTS idx_personas_userid 
ON personas(userId);

-- id 인덱스는 이미 PRIMARY KEY로 존재

-- 3-3. Chats 테이블 최적화 (이미 일부 추가되었지만 추가 최적화)
-- personaId + characterId + createdAt 복합 인덱스 (채팅 히스토리 조회용)
CREATE INDEX IF NOT EXISTS idx_chats_persona_character_created 
ON chats(personaId, characterId, createdAt);

-- characterId + personaId + createdAt 복합 인덱스 (순서 다름 - 다양한 쿼리 패턴 지원)
CREATE INDEX IF NOT EXISTS idx_chats_character_persona_created 
ON chats(characterId, personaId, createdAt);

-- 채팅 목록 조회를 위한 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_chats_group_by_optimization 
ON chats(characterId, personaId, createdAt DESC);

-- 3-4. Character Favors 테이블 최적화
-- userId + characterId 복합 인덱스 (좋아요 상태 확인용)
CREATE INDEX IF NOT EXISTS idx_character_favors_user_character 
ON character_favors(userId, characterId);

-- characterId 인덱스 (캐릭터별 좋아요 수 집계용)
CREATE INDEX IF NOT EXISTS idx_character_favors_character 
ON character_favors(characterId);

-- 3-5. Character Profiles 테이블 최적화
-- userId 인덱스 (사용자가 만든 캐릭터 조회용)
CREATE INDEX IF NOT EXISTS idx_character_profiles_userid 
ON character_profiles(userId);

-- scope 인덱스 (공개/비공개 캐릭터 필터링용)
CREATE INDEX IF NOT EXISTS idx_character_profiles_scope 
ON character_profiles(scope);

-- ============================================
-- 4. 쿼리 최적화 후 다시 실행 계획 확인
-- ============================================

-- 인덱스 추가 후 동일한 쿼리들의 성능 재측정
EXPLAIN SELECT afterHearts FROM heart_transactions WHERE userId = 'test-user' ORDER BY createdAt DESC LIMIT 1;
EXPLAIN SELECT * FROM personas WHERE userId = 'test-user' ORDER BY createdAt DESC;
EXPLAIN SELECT id, sender, message, createdAt FROM chats WHERE personaId = 'test-persona' AND characterId = 1 ORDER BY createdAt ASC LIMIT 50;

-- ============================================
-- 5. 통합 쿼리 테스트 (N+1 문제 해결)
-- ============================================

-- 5-1. 채팅방 입장시 필요한 모든 데이터를 한 번에 가져오는 통합 쿼리
-- (character + persona + hearts + recent messages)
SELECT 
  -- Character Data
  cp.id as character_id,
  cp.name as character_name,
  cp.profileImg as character_profile_img,
  cp.age as character_age,
  cp.job as character_job,
  cp.info as character_info,
  cp.habit as character_habit,
  cp.firstScene as character_first_scene,
  cp.firstMessage as character_first_message,
  
  -- Persona Data  
  p.id as persona_id,
  p.name as persona_name,
  p.avatar as persona_avatar,
  p.gender as persona_gender,
  p.age as persona_age,
  p.job as persona_job,
  p.info as persona_info,
  p.habit as persona_habit,
  
  -- Hearts Data
  ht.afterHearts as current_hearts,
  
  -- Recent Messages Count
  (SELECT COUNT(*) FROM chats WHERE personaId = p.id AND characterId = cp.id) as total_messages
  
FROM character_profiles cp
CROSS JOIN personas p
LEFT JOIN (
  SELECT userId, afterHearts, 
         ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
  FROM heart_transactions
) ht ON ht.userId = p.userId AND ht.rn = 1
WHERE cp.id = ? AND p.id = ?;

-- 5-2. 채팅 목록 조회 최적화 쿼리 (기존 개선)
-- 한 번의 쿼리로 모든 필요한 정보 가져오기
SELECT 
  c.characterId,
  c.personaId,
  c.lastChatTime,
  
  -- Character Info
  cp.name as character_name,
  cp.profileImg as character_profile_img,
  
  -- Persona Info  
  p.name as persona_name,
  p.avatar as persona_avatar,
  
  -- Last Message
  cm.message as last_message,
  cm.sender as last_sender,
  
  -- Hearts
  ht.afterHearts as current_hearts
  
FROM (
  SELECT 
    characterId,
    personaId,
    MAX(createdAt) as lastChatTime
  FROM chats
  GROUP BY characterId, personaId
) c
LEFT JOIN character_profiles cp ON c.characterId = cp.id
LEFT JOIN personas p ON c.personaId = p.id
LEFT JOIN chats cm ON c.characterId = cm.characterId 
                   AND c.personaId = cm.personaId 
                   AND c.lastChatTime = cm.createdAt
LEFT JOIN (
  SELECT userId, afterHearts,
         ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
  FROM heart_transactions
) ht ON ht.userId = p.userId AND ht.rn = 1
WHERE p.userId = ?
ORDER BY c.lastChatTime DESC
LIMIT 20;

-- ============================================
-- 6. 성능 모니터링 쿼리들
-- ============================================

-- 6-1. 느린 쿼리 확인 (MySQL 8.0+)
-- SET GLOBAL log_queries_not_using_indexes = ON;
-- SET GLOBAL slow_query_log = ON;
-- SET GLOBAL long_query_time = 1;

-- 6-2. 인덱스 사용률 확인
SELECT 
  TABLE_SCHEMA,
  TABLE_NAME,
  INDEX_NAME,
  CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'lovlechat'
ORDER BY TABLE_NAME, INDEX_NAME;

-- 6-3. 테이블 크기 및 로우 수 확인  
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as 'Size_MB'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'lovlechat'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- ============================================
-- 7. 캐싱 전략을 위한 쿼리 패턴 분석
-- ============================================

-- 7-1. 자주 조회되는 캐릭터 TOP 10
SELECT 
  cp.id,
  cp.name,
  COUNT(*) as chat_count
FROM chats c
JOIN character_profiles cp ON c.characterId = cp.id
WHERE c.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY cp.id, cp.name
ORDER BY chat_count DESC
LIMIT 10;

-- 7-2. 활성 사용자별 채팅 통계
SELECT 
  p.userId,
  COUNT(DISTINCT c.characterId) as unique_characters,
  COUNT(*) as total_messages,
  MAX(c.createdAt) as last_activity
FROM chats c
JOIN personas p ON c.personaId = p.id
WHERE c.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY p.userId
ORDER BY total_messages DESC
LIMIT 20; 