# LovleChat Express Backend

이 프로젝트는 기존 Next.js 백엔드를 Express.js로 마이그레이션한 버전입니다.

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정

#### Production Environment Variables

Create a `.env.production` file in the backend directory with the following content:

```bash
DB_HOST=lovlechat-db.cf48aygyuqv7.ap-southeast-2.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=Lovle123!
DB_NAME=lovlechat
DB_PORT=3306
NODE_ENV=production
PORT=3002
FRONTEND_URL=https://lovlechat.vercel.app
OPENAI_API_KEY=your_openai_api_key_here
```

#### Development Environment Variables

Create a `.env` file in the backend directory with your local settings:

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=lovlechat
DB_PORT=3306
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key_here
```

## Database Connection

The application will automatically load the appropriate environment file based on the NODE_ENV setting:
- Production: `.env.production`
- Development: `.env`

## Security Notes

- Never commit `.env` or `.env.production` files to version control
- Environment files are listed in `.gitignore` for security
- Use the example files as templates

### 3. 서버 실행

**개발 모드 (nodemon):**
```bash
npm run dev
```

**프로덕션 모드:**
```bash
npm start
```

## 📁 프로젝트 구조

```
backend-express/
├── index.js              # Express 서버 진입점
├── package.json          # 의존성 및 스크립트
├── .env.example          # 환경변수 예시
├── services/             # 비즈니스 로직
│   ├── db.js            # 데이터베이스 서비스
│   └── openai.js        # OpenAI 서비스
└── routes/              # API 라우트
    ├── character.js     # 캐릭터 API
    ├── character-id.js  # 캐릭터 ID별 API
    ├── chat.js          # 채팅 API
    ├── persona.js       # 페르소나 API
    ├── hearts.js        # 하트 API
    ├── payment.js       # 결제 API
    └── test-db.js       # DB 테스트 API
```

## 🔌 API 엔드포인트

### 캐릭터 관련
- `GET /api/character` - 캐릭터 목록 조회
- `POST /api/character` - 캐릭터 생성
- `GET /api/character/:id` - 특정 캐릭터 조회
- `PUT /api/character/:id` - 캐릭터 수정
- `DELETE /api/character/:id` - 캐릭터 숨기기

### 채팅 관련
- `GET /api/chat` - 채팅 히스토리 조회
- `POST /api/chat` - 채팅 메시지 전송
- `DELETE /api/chat` - 채팅 삭제

### 페르소나 관련
- `GET /api/persona` - 페르소나 목록 조회
- `POST /api/persona` - 페르소나 생성

### 하트 관련
- `GET /api/hearts` - 하트 잔액 조회
- `POST /api/hearts` - 하트 거래

### 결제 관련
- `GET /api/payment` - 결제 내역 조회
- `POST /api/payment` - 결제 처리

### 기타
- `GET /api/test-db` - DB 연결 테스트
- `GET /health` - 서버 상태 확인

## 🔧 프론트엔드 연결

프론트엔드에서 API URL을 Express 백엔드로 변경하세요:

### frontend/src/lib/openai.ts
```typescript
// 개발 환경
return 'http://localhost:5000';
```

### frontend/src/hooks/useHearts.ts
```typescript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
```

## 📊 성능 최적화

- **Connection Pooling**: MySQL 연결 풀 사용
- **Query Caching**: 자주 사용되는 쿼리 캐싱
- **Rate Limiting**: API 요청 제한
- **CORS 최적화**: 프론트엔드 도메인만 허용
- **Error Handling**: 포괄적인 에러 처리

## 🛠️ 개발 도구

- **nodemon**: 코드 변경 시 자동 재시작
- **helmet**: 보안 헤더 설정
- **cors**: CORS 처리
- **express-rate-limit**: 요청 제한

## 🚀 배포

### Vercel/Netlify
1. Express 앱을 serverless function으로 변환
2. 환경변수 설정
3. 배포

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 마이그레이션 완료 항목

✅ **API Routes 변환**
- Character API (GET, POST, PUT, DELETE)
- Chat API (GET, POST, DELETE) 
- Persona API (GET, POST)
- Hearts API (GET, POST)
- Payment API (GET, POST)
- Test-DB API (GET)

✅ **서비스 레이어**
- Database service (db.js)
- OpenAI service (openai.js)

✅ **미들웨어**
- CORS 설정
- Rate limiting
- Body parsing
- Error handling

✅ **환경 설정**
- Package.json 구성
- 환경변수 템플릿
- README 작성

## 🎯 다음 단계

1. 프론트엔드 API 호출 테스트
2. 에러 처리 개선
3. 로깅 시스템 추가
4. 유닛 테스트 작성
5. API 문서화 (Swagger)

## 🤝 기여

1. Fork 프로젝트
2. Feature 브랜치 생성
3. 변경사항 커밋
4. Pull Request 생성

## 🎯 주요 기능

### 호감도 시스템
- **별도 DB 관리**: 호감도 정보는 `character_favors` 테이블에 별도 저장
- **채팅 내용 분리**: 호감도 관련 키워드가 채팅 내용에 포함되지 않도록 필터링
- **자연스러운 대화**: AI가 호감도 점수를 인식하지 못하도록 시스템 프롬프트에서 제외

### 호감도 계산 요소
- 메시지 길이 (1-3점)
- 긴 메시지 보너스 (50자 이상: +2점, 100자 이상: +3점)
- 연속 대화 보너스 (5개 메시지마다 +1점)
- 시간대 보너스 (9시-23시: +1점)
- 긍정/부정 키워드 분석
- 질문 보너스 (+1점)
- 이모티콘 보너스 (최대 +3점)

### 호감도 단계
- **아는사이**: 0-19점
- **친구**: 20-49점  
- **썸**: 50-399점
- **연인**: 400-3999점
- **결혼**: 4000점 이상

## 🛠️ 유틸리티 스크립트

### 호감도 키워드 정리
```bash
node clean-favor-keywords.js
```
기존 채팅 데이터에서 호감도 관련 키워드를 자동으로 제거합니다.

## 📊 데이터베이스 구조

### character_favors 테이블
```sql
CREATE TABLE character_favors (
  personaId VARCHAR(50) NOT NULL,
  characterId INT NOT NULL,
  favor INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (personaId, characterId)
);
```

### chats 테이블 (호감도 정보 제외)
```sql
CREATE TABLE chats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  personaId VARCHAR(50) NOT NULL,
  characterId INT NOT NULL,
  message TEXT NOT NULL, -- 호감도 키워드 필터링됨
  sender ENUM('user', 'ai') NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 환경 설정

```bash
# .env 파일 설정
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=1234
DB_NAME=lovlechat
PORT=3002
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
``` 