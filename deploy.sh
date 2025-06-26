#!/bin/bash

# 🚀 LovleChat 배포 스크립트 (최적화 버전)
# 프론트: 로컬 빌드 → EC2 전송
# 백엔드: 압축 → EC2에서 설치/빌드/실행

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 설정 변수
EC2_IP="54.79.211.48"
EC2_USER="ubuntu"
SSH_KEY="./lovlechat-key.pem"
FRONTEND_DIR="./frontend"
BACKEND_DIR="./backend"
EC2_FRONTEND_PATH="/var/www/html"
EC2_BACKEND_PATH="/home/ubuntu/lovlechat-backend"

echo -e "${BLUE}🚀 LovleChat 배포 시작${NC}"
echo "========================================"
echo "EC2 IP: $EC2_IP"
echo "프론트엔드: 로컬 빌드 → EC2 전송"
echo "백엔드: 압축 → EC2 설치/빌드"
echo "========================================"

# 1. 최신 코드 가져오기
git pull origin main



# 3. 백엔드 의존성 설치
echo -e "\n${YELLOW}📦 2. 백엔드 의존성 설치 중...${NC}"
cd $BACKEND_DIR || { echo -e "${RED}❌ 백엔드 디렉토리를 찾을 수 없습니다${NC}"; exit 1; }
npm install || { echo -e "${RED}❌ 백엔드 의존성 설치 실패${NC}"; exit 1; }
cd ..
echo -e "${GREEN}✅ 백엔드 의존성 설치 완료${NC}"

# 4. pm2로 백엔드 재시작 (없으면 백그라운드 실행)
if command -v pm2 > /dev/null; then
  pm2 reload all || pm2 start backend/index.js --name lovlechat
else
  pkill -f "node backend/index.js"
  nohup node backend/index.js > backend.log 2>&1 &
fi

echo -e "${GREEN}✅ 백엔드 재시작 완료${NC}"

# 5. 백엔드 압축 (node_modules, .next 제외)
echo -e "\n${YELLOW}📦 3. 백엔드 압축 중...${NC}"
tar --exclude='node_modules' --exclude='.next' --exclude='*.log' --exclude='.git' \
    -czf backend.tar.gz -C $BACKEND_DIR . || { echo -e "${RED}❌ 백엔드 압축 실패${NC}"; exit 1; }
echo -e "${GREEN}✅ 백엔드 압축 완료 (backend.tar.gz)${NC}"

# 6. EC2에 프론트엔드 전송
echo -e "\n${YELLOW}🚀 4. 프론트엔드 EC2로 전송 중...${NC}"
ssh -i $SSH_KEY $EC2_USER@$EC2_IP "sudo rm -rf $EC2_FRONTEND_PATH/* || true" || true
scp -i $SSH_KEY -r $FRONTEND_DIR/build/* $EC2_USER@$EC2_IP:/tmp/frontend-build/ || { echo -e "${RED}❌ 프론트엔드 전송 실패${NC}"; exit 1; }
ssh -i $SSH_KEY $EC2_USER@$EC2_IP "sudo mv /tmp/frontend-build/* $EC2_FRONTEND_PATH/ && sudo chown -R www-data:www-data $EC2_FRONTEND_PATH" || true
echo -e "${GREEN}✅ 프론트엔드 전송 완료${NC}"

# 7. EC2에 백엔드 전송
echo -e "\n${YELLOW}🚀 5. 백엔드 EC2로 전송 중...${NC}"
scp -i $SSH_KEY backend.tar.gz $EC2_USER@$EC2_IP:/tmp/ || { echo -e "${RED}❌ 백엔드 전송 실패${NC}"; exit 1; }
echo -e "${GREEN}✅ 백엔드 전송 완료${NC}"

# 8. EC2에서 백엔드 설치 및 실행
echo -e "\n${YELLOW}⚙️ 6. EC2에서 백엔드 설치 및 실행 중...${NC}"
ssh -i $SSH_KEY $EC2_USER@$EC2_IP << 'EOF'
set -e

# 백엔드 디렉토리 준비
sudo mkdir -p /home/ubuntu/lovlechat-backend || true
cd /home/ubuntu/lovlechat-backend

# 기존 파일 백업 및 정리
sudo rm -rf ./* || true

# 압축 해제
sudo tar -xzf /tmp/backend.tar.gz -C /home/ubuntu/lovlechat-backend || exit 1
sudo chown -R ubuntu:ubuntu /home/ubuntu/lovlechat-backend

# npm 설치 및 빌드
npm ci || npm install || exit 1
npm run build || exit 1

# PM2로 백엔드 관리
pm2 delete lovlechat-backend || true
pm2 start "npm run start" --name "lovlechat-backend" --cwd "/home/ubuntu/lovlechat-backend" || exit 1

# 정리
rm -f /tmp/backend.tar.gz || true
rm -rf /tmp/frontend-build || true

echo "✅ 백엔드 설치 및 실행 완료"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ EC2 백엔드 설치 및 실행 완료${NC}"
else
    echo -e "${RED}❌ EC2 백엔드 설치 실패${NC}"
    exit 1
fi

# 9. Nginx 재시작
echo -e "\n${YELLOW}🔄 7. Nginx 재시작 중...${NC}"
ssh -i $SSH_KEY $EC2_USER@$EC2_IP "sudo systemctl reload nginx || sudo systemctl restart nginx" || true
echo -e "${GREEN}✅ Nginx 재시작 완료${NC}"

# 10. 로컬 정리
echo -e "\n${YELLOW}🧹 8. 로컬 파일 정리 중...${NC}"
rm -f backend.tar.gz || true
echo -e "${GREEN}✅ 로컬 정리 완료${NC}"

# 11. 배포 상태 확인
echo -e "\n${YELLOW}🔍 9. 배포 상태 확인 중...${NC}"
ssh -i $SSH_KEY $EC2_USER@$EC2_IP "pm2 list | grep lovlechat-backend" || true
ssh -i $SSH_KEY $EC2_USER@$EC2_IP "curl -I http://localhost:3000/api/test-db || curl -I http://localhost:3002/api/test-db" || true

echo -e "\n${GREEN}🎉 배포 완료!${NC}"
echo "========================================"
echo "프론트엔드: http://$EC2_IP"
echo "백엔드 API: http://$EC2_IP/api"
echo "PM2 상태: ssh -i $SSH_KEY $EC2_USER@$EC2_IP 'pm2 status'"
echo "========================================" 