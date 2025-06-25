-- ============================================
-- LovleChat 성능 최적화 인덱스 추가
-- ============================================

-- 실행 전 현재 인덱스 상태 확인
SELECT 'BEFORE INDEX ADDITION - Current Indexes' as status;

SHOW INDEX FROM heart_transactions;
SHOW INDEX FROM personas;  
SHOW INDEX FROM chats;
SHOW INDEX FROM character_favors;
SHOW INDEX FROM character_profiles;

-- ============================================
-- 1. Heart Transactions 테이블 최적화
-- ============================================

-- userId + createdAt 복합 인덱스 (최신 하트 잔액 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_heart_transactions_userid_created 
ON heart_transactions(userId, createdAt DESC);

SELECT 'Added index: idx_heart_transactions_userid_created' as status;

-- ============================================
-- 2. Personas 테이블 최적화
-- ============================================

-- userId 인덱스 (사용자별 페르소나 목록 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_personas_userid 
ON personas(userId);

SELECT 'Added index: idx_personas_userid' as status;

-- ============================================
-- 3. Chats 테이블 추가 최적화
-- ============================================

-- personaId + characterId + createdAt 복합 인덱스 (채팅 히스토리 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chats_persona_character_created 
ON chats(personaId, characterId, createdAt);

-- characterId + personaId + createdAt 복합 인덱스 (다른 순서 - 다양한 쿼리 패턴 지원)
CREATE INDEX IF NOT EXISTS idx_chats_character_persona_created 
ON chats(characterId, personaId, createdAt);

-- 채팅 목록 조회 최적화 (GROUP BY 최적화)
CREATE INDEX IF NOT EXISTS idx_chats_group_by_optimization 
ON chats(characterId, personaId, createdAt DESC);

SELECT 'Added indexes: chats optimization' as status;

-- ============================================
-- 4. Character Favors 테이블 최적화
-- ============================================

-- userId + characterId 복합 인덱스 (좋아요 상태 확인 최적화)
CREATE INDEX IF NOT EXISTS idx_character_favors_user_character 
ON character_favors(userId, characterId);

-- characterId 인덱스 (캐릭터별 좋아요 수 집계 최적화)
CREATE INDEX IF NOT EXISTS idx_character_favors_character 
ON character_favors(characterId);

-- personaId + characterId + createdAt 복합 인덱스 (호감도 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_character_favors_persona_character_created
ON character_favors(personaId, characterId, createdAt DESC);

SELECT 'Added indexes: character_favors optimization' as status;

-- ============================================
-- 5. Character Profiles 테이블 최적화
-- ============================================

-- userId 인덱스 (사용자가 만든 캐릭터 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_character_profiles_userid 
ON character_profiles(userId);

-- scope 인덱스 (공개/비공개 캐릭터 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_character_profiles_scope 
ON character_profiles(scope);

-- createdAt 인덱스 (최신 캐릭터 정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_character_profiles_created 
ON character_profiles(createdAt DESC);

SELECT 'Added indexes: character_profiles optimization' as status;

-- ============================================
-- 6. 인덱스 추가 완료 확인
-- ============================================

SELECT 'AFTER INDEX ADDITION - Updated Indexes' as status;

-- 각 테이블별 인덱스 현황 재확인
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  CARDINALITY,
  INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================
-- 7. 성능 테스트 쿼리들
-- ============================================

-- 7-1. Hearts 조회 성능 테스트
SELECT 'Testing Hearts Query Performance' as test;
EXPLAIN SELECT afterHearts FROM heart_transactions WHERE userId = 'test-user-123' ORDER BY createdAt DESC LIMIT 1;

-- 7-2. Personas 조회 성능 테스트  
SELECT 'Testing Personas Query Performance' as test;
EXPLAIN SELECT * FROM personas WHERE userId = 'test-user-123' ORDER BY createdAt DESC;

-- 7-3. Chats 조회 성능 테스트
SELECT 'Testing Chats Query Performance' as test;
EXPLAIN SELECT id, sender, message, createdAt FROM chats WHERE personaId = 'test-persona' AND characterId = 1 ORDER BY createdAt ASC LIMIT 50;

-- 7-4. Chat List 조회 성능 테스트
SELECT 'Testing Chat List Query Performance' as test;
EXPLAIN SELECT 
  c.characterId,
  c.personaId,
  c.lastChatTime,
  cp.name as character_name,
  cp.profileImg as character_profile_img,
  p.name as persona_name,
  p.avatar as persona_avatar,
  cm.message as last_message
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
WHERE p.userId = 'test-user-123'
ORDER BY c.lastChatTime DESC
LIMIT 20;

-- ============================================
-- 8. 성능 모니터링 설정
-- ============================================

-- 느린 쿼리 로깅 활성화 (필요시)
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 1;
-- SET GLOBAL log_queries_not_using_indexes = 'ON';

SELECT 'Performance optimization indexes added successfully!' as result;

-- 테이블 크기 및 인덱스 크기 확인
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  ROUND((DATA_LENGTH) / 1024 / 1024, 2) as 'Data_MB',
  ROUND((INDEX_LENGTH) / 1024 / 1024, 2) as 'Index_MB',
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as 'Total_MB'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- LovleChat DB 성능 최적화 인덱스 추가
-- 실행 전 반드시 백업을 권장합니다.

-- 1. characters 테이블 인덱스
-- userId 기반 조회 최적화
ALTER TABLE character_profiles ADD INDEX idx_characters_userId (userId);

-- scope 기반 조회 최적화 (공개 캐릭터 조회)
ALTER TABLE character_profiles ADD INDEX idx_characters_scope (scope);

-- 복합 인덱스: userId + scope 조회 최적화
ALTER TABLE character_profiles ADD INDEX idx_characters_userId_scope (userId, scope);

-- createdAt 기반 정렬 최적화
ALTER TABLE character_profiles ADD INDEX idx_characters_created (createdAt);

-- 2. personas 테이블 인덱스
-- userId 기반 조회 최적화
ALTER TABLE personas ADD INDEX idx_personas_userId (userId);

-- 복합 인덱스: userId + createdAt 정렬 최적화
ALTER TABLE personas ADD INDEX idx_personas_userId_created (userId, createdAt);

-- 3. hearts 테이블 인덱스 (이미 있을 수 있지만 확인)
-- uid는 이미 PRIMARY KEY일 가능성이 높지만 확인
-- ALTER TABLE users ADD INDEX idx_users_uid (uid); -- 이미 있을 가능성

-- 4. chats 테이블 인덱스
-- characterId 기반 조회 최적화
ALTER TABLE chats ADD INDEX idx_chats_characterId (characterId);

-- personaId 기반 조회 최적화
ALTER TABLE chats ADD INDEX idx_chats_personaId (personaId);

-- 복합 인덱스: characterId + personaId 조회 최적화
ALTER TABLE chats ADD INDEX idx_chats_char_persona (characterId, personaId);

-- 복합 인덱스: characterId + personaId + createdAt 정렬 최적화
ALTER TABLE chats ADD INDEX idx_chats_char_persona_created (characterId, personaId, createdAt);

-- 5. 기존 인덱스 확인 쿼리
-- SHOW INDEX FROM character_profiles;
-- SHOW INDEX FROM personas;
-- SHOW INDEX FROM users;
-- SHOW INDEX FROM chats;

-- 6. 인덱스 사용량 확인 쿼리 (실행 후 확인용)
-- SELECT 
--   DISTINCT TABLE_NAME,
--   INDEX_NAME,
--   COLUMN_NAME,
--   CARDINALITY
-- FROM information_schema.STATISTICS 
-- WHERE TABLE_SCHEMA = 'lovlechat'
-- ORDER BY TABLE_NAME, INDEX_NAME; 