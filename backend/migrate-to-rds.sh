#!/bin/bash

# 🚀 LovleChat AWS RDS 마이그레이션 스크립트

echo "🎯 LovleChat AWS RDS 마이그레이션을 시작합니다..."

# 환경변수 확인
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
    echo "❌ 환경변수가 설정되지 않았습니다."
    echo "다음 환경변수를 설정해주세요:"
    echo "export DB_HOST=your-rds-endpoint.region.rds.amazonaws.com"
    echo "export DB_USER=admin"
    echo "export DB_PASSWORD=your-password"
    echo "export DB_DATABASE=lovlechat"
    exit 1
fi

echo "✅ 환경변수 확인 완료"
echo "   📍 DB_HOST: $DB_HOST"
echo "   👤 DB_USER: $DB_USER"
echo "   🗄️ DB_DATABASE: $DB_DATABASE"

# MySQL 클라이언트 확인
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 클라이언트가 설치되지 않았습니다."
    echo "다음 명령으로 설치해주세요:"
    echo "  macOS: brew install mysql-client"
    echo "  Ubuntu: sudo apt-get install mysql-client"
    echo "  CentOS: sudo yum install mysql"
    exit 1
fi

echo "✅ MySQL 클라이언트 확인 완료"

# RDS 연결 테스트
echo "🔗 RDS 연결 테스트 중..."
if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo "❌ RDS 연결에 실패했습니다."
    echo "다음을 확인해주세요:"
    echo "  1. RDS 인스턴스가 실행 중인지 확인"
    echo "  2. 보안 그룹에서 3306 포트가 허용되었는지 확인"
    echo "  3. 퍼블릭 액세스가 허용되었는지 확인"
    echo "  4. 사용자명과 비밀번호가 올바른지 확인"
    exit 1
fi

echo "✅ RDS 연결 성공!"

# 데이터베이스 생성
echo "🗄️ 데이터베이스 생성 중..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 스키마 실행
echo "📋 메인 스키마 실행 중..."
if [ -f "database-schema.sql" ]; then
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" < database-schema.sql
    echo "✅ 메인 스키마 실행 완료"
else
    echo "❌ database-schema.sql 파일을 찾을 수 없습니다."
    exit 1
fi

# 누락된 테이블 생성
if [ -f "create-missing-tables.sql" ]; then
    echo "🔧 누락된 테이블 생성 중..."
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" < create-missing-tables.sql
    echo "✅ 누락된 테이블 생성 완료"
fi

# 테이블 확인
echo "🔍 생성된 테이블 확인 중..."
TABLES=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" -e "SHOW TABLES;" 2>/dev/null | grep -v "Tables_in_" | tr '\n' ', ' | sed 's/,$//')

if [ -n "$TABLES" ]; then
    echo "✅ 다음 테이블이 생성되었습니다:"
    echo "   $TABLES"
else
    echo "❌ 테이블이 생성되지 않았습니다."
    exit 1
fi

# 필수 테이블 확인
REQUIRED_TABLES=("users" "personas" "character_profiles" "chats" "character_favors" "heart_transactions")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" -e "DESCRIBE $table;" &> /dev/null; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo "✅ 모든 필수 테이블이 생성되었습니다!"
else
    echo "⚠️ 다음 테이블이 누락되었습니다: ${MISSING_TABLES[*]}"
fi

echo ""
echo "🎉 마이그레이션이 완료되었습니다!"
echo ""
echo "📝 다음 단계:"
echo "  1. 환경변수 설정 확인"
echo "  2. 백엔드 서버 실행: npm run dev"
echo "  3. API 테스트: curl http://localhost:3002/api/test-db"
echo "  4. 프로덕션 배포: vercel --prod"
echo ""
echo "🔗 유용한 명령어:"
echo "  # RDS 연결"
echo "  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE"
echo ""
echo "  # 테이블 확인"
echo "  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE -e 'SHOW TABLES;'"
echo ""
echo "✨ AWS RDS 마이그레이션이 성공적으로 완료되었습니다!" 