# Dockerfile

# Node.js LTS 버전으로 설정
FROM node:18

# 앱 디렉토리 생성
WORKDIR /app

# 종속성 복사 및 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY .env .env

COPY . .

# 포트 오픈
EXPOSE 3302

# 앱 실행 명령어 (Express 기준)
CMD ["node", "index.js"]