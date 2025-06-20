#!/bin/bash

# ====================================
# AWS RDS 마이그레이션 스크립트
# ====================================

echo "🚀 AWS RDS 마이그레이션 시작..."

# RDS 연결 정보 (사용자가 수정 필요)
RDS_HOST="lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com"  # AWS RDS 엔드포인트
RDS_PORT="3306"
RDS_USER="admin"
RDS_PASSWORD="Lovle123!"
RDS_DATABASE="lovlechat"

# 1. RDS 연결 테스트
echo "📡 RDS 연결 테스트 중..."
mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD -e "SELECT 1;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ RDS 연결 성공!"
else
    echo "❌ RDS 연결 실패. 연결 정보를 확인해주세요."
    exit 1
fi

# 2. 데이터베이스 및 테이블 생성
echo "🗄️ 데이터베이스 및 테이블 생성 중..."
mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD < rds_complete_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ 스키마 생성 완료!"
else
    echo "❌ 스키마 생성 실패"
    exit 1
fi

# 3. 로컬 데이터 백업 파일 확인
BACKUP_FILE=$(ls lovlechat_backup_*.sql | head -n 1)
if [ -z "$BACKUP_FILE" ]; then
    echo "❌ 백업 파일을 찾을 수 없습니다."
    exit 1
fi

echo "📦 백업 파일 발견: $BACKUP_FILE"

# 4. 데이터 마이그레이션 (외래키 제약조건 잠시 비활성화)
echo "🔄 데이터 마이그레이션 중... (시간이 좀 걸릴 수 있습니다)"

# 외래키 체크 비활성화 및 데이터 삽입
mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE << EOF
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
EOF

# 백업 데이터 복원 (CREATE TABLE 문 제외하고 INSERT만)
sed '/^CREATE TABLE/,/^)/d; /^DROP TABLE/d; /^LOCK TABLES/d; /^UNLOCK TABLES/d' $BACKUP_FILE | \
mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE

# 외래키 체크 다시 활성화
mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE << EOF
COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
EOF

if [ $? -eq 0 ]; then
    echo "✅ 데이터 마이그레이션 완료!"
else
    echo "❌ 데이터 마이그레이션 실패"
    exit 1
fi

# 5. 데이터 검증
echo "🔍 데이터 검증 중..."
USER_COUNT=$(mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE -se "SELECT COUNT(*) FROM users;")
PERSONA_COUNT=$(mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE -se "SELECT COUNT(*) FROM personas;")
CHARACTER_COUNT=$(mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE -se "SELECT COUNT(*) FROM character_profiles;")
CHAT_COUNT=$(mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASSWORD $RDS_DATABASE -se "SELECT COUNT(*) FROM chats;")

echo "📊 마이그레이션 결과:"
echo "   👤 사용자: $USER_COUNT 명"
echo "   👥 페르소나: $PERSONA_COUNT 개"
echo "   🤖 캐릭터: $CHARACTER_COUNT 개"
echo "   💬 채팅: $CHAT_COUNT 건"

echo ""
echo "🎉 AWS RDS 마이그레이션 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. backend/.env.development.cloud 파일에서 RDS 연결 정보 확인"
echo "2. npm run dev:cloud 명령으로 클라우드 DB 테스트"
echo "3. 백엔드 배포 시 환경변수 설정"
echo "" 