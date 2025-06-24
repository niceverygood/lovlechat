-- 데이터베이스 성능 최적화를 위한 인덱스 추가
-- 실행 전에 현재 인덱스 상태를 확인하고 중복되지 않도록 주의

-- 1. chats 테이블 인덱스 (채팅 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chats_persona_character 
ON chats (personaId, characterId);

CREATE INDEX IF NOT EXISTS idx_chats_created_at 
ON chats (createdAt);

CREATE INDEX IF NOT EXISTS idx_chats_persona_character_created 
ON chats (personaId, characterId, createdAt);

-- 2. character_profiles 테이블 인덱스 (캐릭터 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_character_profiles_user_id 
ON character_profiles (userId);

CREATE INDEX IF NOT EXISTS idx_character_profiles_scope 
ON character_profiles (scope);

CREATE INDEX IF NOT EXISTS idx_character_profiles_created_at 
ON character_profiles (createdAt);

-- 3. personas 테이블 인덱스 (페르소나 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_personas_user_id 
ON personas (userId);

CREATE INDEX IF NOT EXISTS idx_personas_created_at 
ON personas (createdAt);

-- 4. heart_transactions 테이블 인덱스 (하트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_heart_transactions_user_id 
ON heart_transactions (userId);

CREATE INDEX IF NOT EXISTS idx_heart_transactions_created_at 
ON heart_transactions (createdAt);

CREATE INDEX IF NOT EXISTS idx_heart_transactions_user_created 
ON heart_transactions (userId, createdAt);

-- 5. character_favors 테이블 인덱스 (호감도 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_character_favors_persona_character 
ON character_favors (personaId, characterId);

-- 인덱스 생성 완료 확인
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'lovlechat' 
  AND TABLE_NAME IN ('chats', 'character_profiles', 'personas', 'heart_transactions', 'character_favors')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX; 