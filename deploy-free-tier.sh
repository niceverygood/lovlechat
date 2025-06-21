#!/bin/bash

# 🆓 LovleChat 프리 티어 EC2 배포 스크립트 (최적화 버전)
# 사용법: ./deploy-free-tier.sh [EC2_IP] [KEY_PATH]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 변수 설정
EC2_IP=${1:-"your-ec2-ip"}
KEY_PATH=${2:-"~/.ssh/lovlechat-key.pem"}
DEPLOY_USER="ubuntu"
APP_DIR="/home/ubuntu/lovlechat"
REPO_URL="https://github.com/niceverygood/lovlechat.git"

echo -e "${BLUE}🆓 LovleChat 프리 티어 EC2 배포 시작${NC}"
echo "EC2 IP: $EC2_IP"
echo "KEY PATH: $KEY_PATH"
echo "최적화 모드: 프리 티어 (t2.micro)"
echo "------------------------------------"

# 1. SSH 연결 테스트
echo -e "${YELLOW}📡 SSH 연결 테스트 중...${NC}"
if ssh -i "$KEY_PATH" -o ConnectTimeout=10 "$DEPLOY_USER@$EC2_IP" "echo 'SSH 연결 성공'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH 연결 성공${NC}"
else
    echo -e "${RED}❌ SSH 연결 실패. IP와 키 파일을 확인하세요.${NC}"
    exit 1
fi

# 2. 프리 티어 환경 설정
echo -e "${YELLOW}🔧 프리 티어 환경 설정 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    # 시스템 업데이트
    echo "⏳ 시스템 업데이트 중..."
    sudo apt update -y
    sudo apt upgrade -y
    
    # 스왑 메모리 설정 (프리 티어 필수!)
    echo "💾 1GB 스왑 메모리 설정 중..."
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 1G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "✅ 스왑 메모리 설정 완료"
    else
        echo "✅ 스왑 메모리 이미 설정됨"
    fi
    
    # Node.js 18 설치 (LTS)
    echo "📦 Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # PM2 글로벌 설치
    echo "🔄 PM2 설치 중..."
    sudo npm install -g pm2
    
    # Nginx 설치 및 설정
    echo "🌐 Nginx 설치 중..."
    sudo apt install -y nginx
    
    # 프리 티어 최적화 Nginx 설정
    sudo tee /etc/nginx/sites-available/lovlechat > /dev/null << 'NGINX_EOF'
# 프리 티어 최적화 Nginx 설정
worker_processes 1;  # CPU 1개에 맞춤
worker_connections 512;  # 연결 수 제한

events {
    worker_connections 512;
    use epoll;
}

http {
    # 기본 설정
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # 성능 최적화
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 30;  # 짧게 설정
    types_hash_max_size 2048;
    client_max_body_size 10M;
    
    # Gzip 압축 (대역폭 절약)
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # 캐싱 설정
    expires 7d;
    add_header Cache-Control "public, immutable";
    
    server {
        listen 80;
        server_name _;
        
        # 프론트엔드 (React)
        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
        
        # 백엔드 API (Next.js)
        location /api {
            proxy_pass http://127.0.0.1:3002;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }
}
NGINX_EOF
    
    # Nginx 설정 활성화 (기존 default 설정을 lovlechat 설정으로 교체)
    echo "🔌 Nginx 설정을 활성화합니다..."
    sudo ln -sf /etc/nginx/sites-available/lovlechat /etc/nginx/sites-enabled/default

    # nginx.conf의 include 경로가 /etc/nginx/sites-enabled/* 로 되어있을 경우, 
    # default만 읽도록 명시적으로 변경하여 다른 설정 파일과의 충돌을 방지합니다.
    echo "🔧 nginx.conf의 include 경로를 수정합니다..."
    if sudo grep -q "/etc/nginx/sites-enabled/\\*;" /etc/nginx/nginx.conf; then
        sudo sed -i 's|include /etc/nginx/sites-enabled/\\*;|include /etc/nginx/sites-enabled/default;|g' /etc/nginx/nginx.conf
        echo "✅ include 경로를 /etc/nginx/sites-enabled/default 로 변경했습니다."
    else
        echo "✅ include 경로가 이미 올바르게 설정되어 있거나, 기본 설정이 아닙니다. 건너뜁니다."
    fi
    
    # Nginx 설정 테스트 및 재시작
    echo "⚙️ Nginx 설정 테스트 및 재시작..."
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "✅ 프리 티어 환경 설정 완료"
EOF

# 3. 애플리케이션 배포
echo -e "${YELLOW}📂 애플리케이션 배포 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    # 기존 디렉토리 제거 및 새로 클론
    rm -rf $APP_DIR
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
    
    # 백엔드 빌드 (메모리 제한 적용)
    echo "🔨 백엔드 빌드 중..."
    cd backend
    NODE_OPTIONS="--max-old-space-size=400" npm install
    NODE_OPTIONS="--max-old-space-size=400" npm run build
    
    # 프론트엔드 빌드 (메모리 제한 적용)
    echo "🎨 프론트엔드 빌드 중..."
    cd ../frontend
    NODE_OPTIONS="--max-old-space-size=400" npm install
    NODE_OPTIONS="--max-old-space-size=400" npm run build
    
    # Serve 글로벌 설치
    sudo npm install -g serve
    
    # 로그 디렉토리 생성
    mkdir -p $APP_DIR/logs
    
    echo "✅ 애플리케이션 빌드 완료"
EOF

# 4. 환경변수 설정
echo -e "${YELLOW}🔧 환경변수 설정 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    cd /home/ubuntu/lovlechat/backend
    
    # 환경변수 파일 생성
    cat > .env << 'ENV_EOF'
# 🔧 LovleChat EC2 Production Environment Variables
NODE_ENV=production

# 데이터베이스 설정 (AWS RDS)
DB_HOST=lovlechat.c9qrb8j7h7pf.ap-northeast-2.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=lovlechat123!
DB_DATABASE=lovlechat
DB_PORT=3306

# 서버 설정
PORT=3002
FRONTEND_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# OpenAI API (채팅 기능용) - 실제 키로 교체 필요
OPENAI_API_KEY=sk-your-openai-api-key

# 아임포트 결제 설정 - 실제 키로 교체 필요
IAMPORT_KEY=your-iamport-key
IAMPORT_SECRET=your-iamport-secret

# Firebase 설정 (인증용) - 실제 설정으로 교체 필요
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-firebase-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# 로그 레벨
LOG_LEVEL=info

# CORS 설정
CORS_ORIGIN=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# 캐시 설정
CACHE_TTL=300
MAX_CACHE_SIZE=100

# EC2 전용 설정
IS_EC2=true
ENV_EOF
    
    echo "✅ 환경변수 설정 완료"
    echo "⚠️  OpenAI, 아임포트, Firebase 키는 수동으로 설정하세요"
EOF

# 5. PM2로 애플리케이션 시작
echo -e "${YELLOW}🚀 애플리케이션 시작 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    cd $APP_DIR
    
    # PM2로 애플리케이션 시작
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup
    
    echo "✅ 애플리케이션 시작 완료"
EOF

# 6. 방화벽 설정
echo -e "${YELLOW}🔒 방화벽 설정 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    # UFW 방화벽 설정
    sudo ufw allow ssh
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw allow 3001
    sudo ufw allow 3002
    sudo ufw --force enable
    
    echo "✅ 방화벽 설정 완료"
EOF

# 7. 상태 확인
echo -e "${YELLOW}📊 배포 상태 확인 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    echo "=== PM2 프로세스 상태 ==="
    pm2 status
    
    echo -e "\n=== 메모리 사용량 ==="
    free -h
    
    echo -e "\n=== 디스크 사용량 ==="
    df -h
    
    echo -e "\n=== Nginx 상태 ==="
    sudo systemctl status nginx --no-pager -l
EOF

echo -e "${GREEN}🎉 프리 티어 배포 완료!${NC}"
echo ""
echo "=== 접속 정보 ==="
echo "🌐 웹사이트: http://$EC2_IP"
echo "📱 프론트엔드: http://$EC2_IP:3001"
echo "🔧 백엔드 API: http://$EC2_IP:3002"
echo ""
echo "=== 관리 명령어 ==="
echo "모니터링: ./monitor.sh status $EC2_IP $KEY_PATH"
echo "로그 확인: ./monitor.sh logs $EC2_IP $KEY_PATH"
echo "재시작: ./monitor.sh restart $EC2_IP $KEY_PATH"
echo ""
echo "=== 성능 최적화 적용됨 ==="
echo "✅ 스왑 메모리: 1GB"
echo "✅ 백엔드 메모리 제한: 512MB"
echo "✅ 프론트엔드 메모리 제한: 256MB"
echo "✅ Nginx 최적화 설정"
echo "✅ Gzip 압축 활성화"
echo ""
echo -e "${PURPLE}💡 프리 티어 권장 동시 접속자: 5-10명${NC}"
echo -e "${PURPLE}💡 예상 응답 시간: 300ms-1s${NC}" 