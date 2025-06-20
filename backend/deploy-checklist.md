# 🚀 LovleChat AWS RDS 배포 체크리스트

## ✅ 1. 환경변수 설정 확인

### 필수 환경변수 (.env.local)
```bash
# 🔑 데이터베이스 연결 (AWS RDS)
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-secure-password
DB_DATABASE=lovlechat

# 🤖 OpenAI API
OPENAI_API_KEY=sk-proj-your-api-key

# 🌍 환경 설정
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.com
```

## ✅ 2. AWS RDS 설정 확인

### RDS 인스턴스 설정
- [ ] MySQL 8.0+ 사용
- [ ] 문자셋: utf8mb4
- [ ] 콜레이션: utf8mb4_unicode_ci
- [ ] 퍼블릭 액세스 허용 (VPC 설정에 따라)
- [ ] 보안 그룹에서 3306 포트 허용

### 연결 테스트
```bash
# CLI에서 RDS 연결 테스트
mysql -h your-rds-endpoint.region.rds.amazonaws.com -u admin -p lovlechat
```

## ✅ 3. 데이터베이스 스키마 마이그레이션

### 3-1. 스키마 생성
```bash
# 1. RDS에 연결하여 스키마 실행
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE < database-schema.sql

# 2. 누락된 테이블 생성 (필요시)
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE < create-missing-tables.sql
```

### 3-2. 테이블 검증
```sql
-- 모든 테이블이 생성되었는지 확인
SHOW TABLES;

-- 예상 테이블 목록:
-- users, personas, character_profiles, chats, character_favors, character_hidden, heart_transactions
```

## ✅ 4. 코드 수정 사항 (완료됨)

### 4-1. JSON Parse 에러 수정 ✅
- `backend/src/app/api/character/[id]/route.ts`: tags 필드 올바른 파싱
- `backend/src/lib/db-helper.ts`: parseJsonSafely 함수 개선

### 4-2. 스키마 일치성 확인 ✅
- 모든 API에서 사용하는 컬럼이 스키마에 정의됨
- 외래키 제약조건 올바르게 설정됨

## ✅ 5. 배포 전 테스트

### 5-1. DB 연결 테스트
```bash
# 백엔드 서버 실행
cd backend
npm run dev

# 연결 테스트 API 호출
curl http://localhost:3002/api/test-db
```

### 5-2. 예상 응답
```json
{
  "ok": true,
  "message": "🎉 DB 연결 성공!",
  "status": "READY",
  "existingTables": ["users", "personas", "character_profiles", "chats", "character_favors", "heart_transactions"],
  "missingTables": []
}
```

## ✅ 6. 성능 최적화 확인

### 6-1. 인덱스 확인 ✅
```sql
-- 중요 인덱스들이 생성되었는지 확인
SHOW INDEX FROM chats;
SHOW INDEX FROM character_profiles;
SHOW INDEX FROM personas;
```

### 6-2. 연결 풀 설정 ✅
- 연결 제한: 10개 (메모리 절약)
- 타임아웃: 10초
- Keep-alive 활성화

## ✅ 7. 보안 설정

### 7-1. 데이터베이스 보안 ✅
- SSL 연결 활성화 (프로덕션)
- 강력한 비밀번호 사용
- 필요한 포트만 개방

### 7-2. API 보안 ✅
- CORS 설정 완료
- 입력 데이터 검증 및 정규화
- SQL 인젝션 방지 (Prepared Statements)

## ✅ 8. 모니터링 설정

### 8-1. 로깅 ✅
- DB 연결 상태 모니터링
- 느린 쿼리 감지 (2초 이상)
- 에러 로깅 및 폴백 처리

### 8-2. 하트 시스템 확인 ✅
- 사용자별 하트 관리
- 거래 내역 추적
- 부족시 적절한 에러 처리

## 🚀 9. 배포 단계

### 9-1. 환경변수 설정
```bash
# Vercel 배포시
vercel env add DB_HOST
vercel env add DB_PORT  
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add DB_DATABASE
vercel env add OPENAI_API_KEY
```

### 9-2. 배포 명령
```bash
# 프로덕션 빌드
npm run build

# 배포 (Vercel)
vercel --prod
```

## 🔍 10. 배포 후 검증

### 10-1. 필수 API 테스트
```bash
# 1. DB 연결 테스트
curl https://your-domain.com/api/test-db

# 2. 하트 시스템 테스트  
curl https://your-domain.com/api/hearts?userId=test

# 3. 캐릭터 조회 테스트
curl https://your-domain.com/api/character/1

# 4. 페르소나 조회 테스트  
curl https://your-domain.com/api/persona?userId=test
```

### 10-2. 프론트엔드 연동 테스트
- [ ] 로그인 후 페르소나 생성
- [ ] 캐릭터와 채팅 시작
- [ ] 하트 차감 정상 동작
- [ ] 호감도 시스템 동작

## ⚠️ 알려진 이슈 및 해결책

### Issue 1: JSON Parse 에러 (해결됨 ✅)
- **문제**: `tags` 필드에 단순 문자열 저장시 JSON.parse 실패
- **해결**: parseJsonSafely 함수 개선으로 단순 문자열도 처리

### Issue 2: 연결 타임아웃
- **문제**: RDS 연결시 간헐적 타임아웃
- **해결**: 연결 풀 최적화 및 재시도 로직 구현

### Issue 3: 하트 시스템 초기화
- **문제**: 신규 사용자의 하트가 없음
- **해결**: API에서 자동으로 초기 하트(100개) 생성

## 📞 문제 해결

### DB 연결 실패시
1. 환경변수 재확인
2. RDS 보안 그룹 설정 확인
3. 네트워크 연결 상태 확인
4. `/api/test-db` 엔드포인트로 상세 에러 확인

### 성능 이슈시
1. 느린 쿼리 로그 확인
2. 인덱스 사용 여부 점검
3. 연결 풀 설정 조정

---

## ✅ 최종 배포 승인 조건

- [ ] 모든 환경변수 설정 완료
- [ ] RDS 연결 및 스키마 생성 완료  
- [ ] `/api/test-db` 테스트 통과
- [ ] 주요 API 엔드포인트 정상 동작
- [ ] 프론트엔드 연동 테스트 완료
- [ ] 보안 설정 검토 완료

**🎉 모든 체크가 완료되면 프로덕션 배포 준비 완료!** 