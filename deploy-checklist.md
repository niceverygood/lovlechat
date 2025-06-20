# 🚀 LovleChat 배포 체크리스트

## ✅ 배포 전 확인사항
- [ ] 로컬 수정 완료
- [ ] RDS 마이그레이션 완료 (553개 레코드)
- [ ] 로컬-RDS 연동 테스트 완료
- [ ] Git 커밋 및 푸시 완료

## 🖥️ 백엔드 배포 (Vercel)
### 1. 배포 실행
```bash
cd backend
npx vercel --prod
```

### 2. 환경변수 설정 (Vercel Dashboard)
```
NODE_ENV=production
DB_HOST=lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=Lovle123!
DB_DATABASE=lovlechat
PORTONE_API_KEY=9022927126860124
PORTONE_SECRET=b1d469864e7b5c52a9c3c98fd55b15e4ee6c62b9ed06eda3c96e0ca1e29ee77ad78e56e0b3a6
```

### 3. 배포 후 테스트
```bash
node deploy-test.js https://your-backend-url.vercel.app
```

## 🌐 프론트엔드 배포 (Vercel)
### 1. package.json 수정 (배포용 백엔드 URL)
```json
{
  "proxy": "https://your-backend-url.vercel.app"
}
```

### 2. 배포 실행
```bash
cd frontend
npx vercel --prod
```

### 3. 환경변수 설정
```
REACT_APP_API_URL=https://your-backend-url.vercel.app
```

## 🧪 통합 테스트
### 배포된 서비스에서 확인할 기능들:
- [ ] 로그인/회원가입
- [ ] 하트 시스템 (현재 5328개 하트)
- [ ] 캐릭터 생성/조회
- [ ] 페르소나 생성/관리 (현재 3개)
- [ ] 채팅 기능 (433개 채팅 기록)
- [ ] 호감도 시스템 (24개 호감도 기록)
- [ ] 결제 시스템 (3개 결제 기록)

## 📊 현재 RDS 데이터 현황
- **사용자**: 6명
- **캐릭터**: 43개
- **페르소나**: 8개  
- **채팅**: 433개
- **호감도**: 24개
- **하트 거래**: 36개
- **결제 기록**: 3개

## ❗ 주의사항
1. 환경변수에 DB 패스워드가 포함되어 있으니 보안 주의
2. CORS 설정이 vercel.json에 이미 구성됨
3. 배포 후 첫 접속시 Cold Start로 인한 지연 가능
4. RDS 연결 제한 확인 (현재 연결 풀 설정됨)

## 🔧 문제 해결
### 자주 발생하는 문제:
1. **DB 연결 실패**: RDS 보안 그룹 인바운드 규칙 확인
2. **CORS 에러**: vercel.json 헤더 설정 확인
3. **환경변수 미적용**: Vercel 재배포 필요
4. **Cold Start**: 첫 API 호출 시 15-30초 지연 정상

## 📞 배포 완료 후 알림
배포가 완료되면 다음 URL들을 확인:
- 프론트엔드: `https://your-frontend-url.vercel.app`
- 백엔드: `https://your-backend-url.vercel.app`
- DB 테스트: `https://your-backend-url.vercel.app/api/test-db` 