#!/bin/bash

# 🔍 AWS RDS 연결 테스트 스크립트

echo "🔗 AWS RDS 연결 테스트를 시작합니다..."

# 환경변수 확인
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
    echo "❌ 환경변수가 설정되지 않았습니다."
    echo ""
    echo "다음 명령으로 환경변수를 설정하세요:"
    echo "export DB_HOST=your-rds-endpoint.region.rds.amazonaws.com"
    echo "export DB_USER=admin"
    echo "export DB_PASSWORD=your-password"
    echo "export DB_DATABASE=lovlechat"
    echo ""
    echo "또는 .env.local 파일에 설정하고 source .env.local 실행"
    exit 1
fi

echo "✅ 환경변수 확인 완료"
echo "   📍 Host: $DB_HOST"
echo "   👤 User: $DB_USER"
echo "   🗄️ Database: $DB_DATABASE"
echo ""

# 기본 연결 테스트
echo "🔗 기본 연결 테스트..."
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 'Connection OK' as status;" 2>/dev/null; then
    echo "✅ RDS 연결 성공!"
else
    echo "❌ RDS 연결 실패"
    echo ""
    echo "🛠️ 문제 해결 가이드:"
    echo "1. RDS 인스턴스가 'Available' 상태인지 확인"
    echo "2. 보안 그룹에서 3306 포트 인바운드 규칙 확인"
    echo "3. 퍼블릭 액세스 허용 설정 확인"
    echo "4. DB 사용자명/비밀번호 확인"
    echo "5. VPC 및 서브넷 설정 확인"
    exit 1
fi

# 데이터베이스 존재 여부 확인
echo ""
echo "🗄️ 데이터베이스 확인..."
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_DATABASE; SELECT 'Database exists' as status;" 2>/dev/null; then
    echo "✅ 데이터베이스 '$DB_DATABASE' 존재 확인"
else
    echo "⚠️ 데이터베이스 '$DB_DATABASE'가 존재하지 않습니다"
    echo "자동으로 생성하시겠습니까? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        echo "✅ 데이터베이스 생성 완료"
    fi
fi

# 테이블 확인
echo ""
echo "📋 테이블 확인..."
TABLE_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_DATABASE';" 2>/dev/null | tail -n 1)

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "✅ $TABLE_COUNT 개의 테이블이 존재합니다"
    echo ""
    echo "📋 테이블 목록:"
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" -e "SHOW TABLES;" 2>/dev/null | grep -v "Tables_in_"
else
    echo "⚠️ 테이블이 없습니다. 스키마를 실행해야 합니다"
    echo ""
    echo "다음 명령으로 스키마를 실행하세요:"
    echo "./migrate-to-rds.sh"
fi

echo ""
echo "🎯 연결 테스트 완료!"
echo ""
echo "📝 다음 단계:"
if [ "$TABLE_COUNT" -eq 0 ]; then
    echo "  1. 스키마 실행: ./migrate-to-rds.sh"
    echo "  2. 백엔드 테스트: npm run dev"
    echo "  3. API 테스트: curl http://localhost:3002/api/test-db"
else
    echo "  1. 백엔드 테스트: npm run dev"
    echo "  2. API 테스트: curl http://localhost:3002/api/test-db"
    echo "  3. 프로덕션 배포: vercel --prod"
fi 