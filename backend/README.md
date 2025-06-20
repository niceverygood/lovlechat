# 💝 LovleChat Backend

🚀 **AI 캐릭터 채팅 앱 백엔드 서버**

## 🏗️ 기술 스택
- **Framework**: Next.js 15.3.3 (App Router)
- **Database**: MySQL 8.0+
- **AI**: OpenAI GPT-4o-mini
- **Deployment**: Vercel

## 🚀 배포 가이드

### 📊 **1. 데이터베이스 설정 (가장 중요!)**

#### 필수 테이블 스키마:
```sql
-- 페르소나 테이블
CREATE TABLE personas (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(100) NOT NULL,
  name VARCHAR(50) NOT NULL,
  avatar TEXT,
  gender VARCHAR(10),
  age VARCHAR(10),
  job VARCHAR(50),
  info TEXT,
  habit TEXT,
  personality TEXT,
  interests TEXT,
  background TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 캐릭터 프로필 테이블
CREATE TABLE character_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId VARCHAR(100),
  profileImg TEXT,
  name VARCHAR(50) NOT NULL,
  age VARCHAR(10),
  job VARCHAR(50),
  oneLiner TEXT,
  background TEXT,
  personality TEXT,
  habit TEXT,
  likes TEXT,
  dislikes TEXT,
  extraInfos TEXT,
  gender VARCHAR(10),
  scope VARCHAR(10) DEFAULT '공개',
  roomCode VARCHAR(20),
  category VARCHAR(20),
  tags TEXT,
  attachments TEXT,
  firstScene TEXT,
  firstMessage TEXT,
  backgroundImg TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 채팅 메시지 테이블
CREATE TABLE chats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  personaId VARCHAR(50) NOT NULL,
  characterId INT NOT NULL,
  message TEXT NOT NULL,
  sender ENUM('user', 'ai') NOT NULL,
  characterName VARCHAR(50),
  characterProfileImg TEXT,
  characterAge VARCHAR(10),
  characterJob VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 호감도 테이블
CREATE TABLE character_favors (
  personaId VARCHAR(50),
  characterId INT,
  favor INT DEFAULT 0,
  PRIMARY KEY (personaId, characterId)
);

-- 숨김 처리 테이블
CREATE TABLE character_hidden (
  userId VARCHAR(100),
  characterId INT,
  PRIMARY KEY (userId, characterId)
);
```

### 🔧 **2. 환경변수 설정**

Vercel 대시보드에서 다음 환경변수들을 설정하세요:

```bash
# 서버 환경
NODE_ENV=production

# 데이터베이스 (필수!)
DB_HOST=your-database-host.com
DB_PORT=3306
DB_USER=your-username  
DB_PASSWORD=your-secure-password
DB_DATABASE=lovlechat

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# Next.js 보안
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-32-character-key
```

### 📊 **3. 추천 DB 서비스**

#### 🥇 **PlanetScale (추천)**
- MySQL 호환
- 자동 스케일링
- 브랜치 기반 스키마 관리
- 무료 플랜 제공

#### 🥈 **Supabase**
- PostgreSQL 기반 (스키마 수정 필요)
- 실시간 기능
- 무료 플랜 제공

#### 🥉 **Railway**
- MySQL/PostgreSQL 지원
- 간단한 설정
- 합리적인 가격

### 🚀 **4. 배포 명령어**

```bash
# 1. 의존성 설치
npm install

# 2. 타입 체크
npm run type-check

# 3. 빌드 테스트
npm run build

# 4. 프로덕션 시작
npm run start:prod
```

### ⚠️ **5. 배포 전 체크리스트**

- [ ] **DB 연결** 테스트 완료
- [ ] **환경변수** 모두 설정
- [ ] **OpenAI API** 크레딧 확인
- [ ] **CORS 설정** 확인
- [ ] **DB 백업** 완료
- [ ] **빌드 에러** 없음

### 🔍 **6. 배포 후 확인사항**

```bash
# API 상태 체크
curl https://your-backend.vercel.app/api/test-db

# DB 연결 확인
curl https://your-backend.vercel.app/api/character

# 채팅 기능 확인  
curl -X POST https://your-backend.vercel.app/api/chat
```

## 🛠️ 개발 환경

### 로컬 개발 시작:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.

### 성능 최적화:

```bash
# Turbo 모드로 빠른 개발
npm run dev:turbo

# 번들 크기 분석
npm run build:analyze
```

## 📝 API 엔드포인트

- `POST /api/chat` - 채팅 메시지 전송
- `GET /api/character` - 캐릭터 목록
- `GET /api/persona` - 페르소나 목록
- `POST /api/chat/generate-background` - 배경 이미지 생성

## 🎯 핵심 기능

- 🤖 **AI 채팅**: GPT-4o-mini 기반 롤플레잉
- 🎨 **배경 생성**: DALL-E 3 이미지 생성
- 💝 **호감도 시스템**: 대화 기반 호감도 변화
- 👤 **페르소나**: 사용자 맞춤 캐릭터
- 📱 **반응형**: 모바일 최적화

## 🔧 기술적 특징

- **연결 풀링**: MySQL 성능 최적화
- **에러 핸들링**: 안정적인 API 응답
- **CORS 지원**: 프론트엔드 연동
- **타입 안전성**: TypeScript 사용

---

**🚀 배포 성공을 위해 DB 설정이 가장 중요합니다!**
