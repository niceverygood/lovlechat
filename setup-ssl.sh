#!/bin/bash

# 🔒 SSL 인증서 설정 스크립트 (Let's Encrypt)
# 사용법: ./setup-ssl.sh [DOMAIN] [EC2_IP] [KEY_PATH]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 변수 설정
DOMAIN=${1:-"your-domain.com"}
EC2_IP=${2:-"your-ec2-ip"}
KEY_PATH=${3:-"~/.ssh/lovlechat-key.pem"}
DEPLOY_USER="ubuntu"

echo -e "${BLUE}🔒 SSL 인증서 설정 시작${NC}"
echo "도메인: $DOMAIN"
echo "EC2 IP: $EC2_IP"
echo "------------------------------------"

if [ "$DOMAIN" = "your-domain.com" ]; then
    echo -e "${RED}❌ 실제 도메인을 입력하세요!${NC}"
    echo "사용법: ./setup-ssl.sh your-domain.com $EC2_IP $KEY_PATH"
    exit 1
fi

# 1. Certbot 설치 및 인증서 발급
echo -e "${YELLOW}📜 Certbot 설치 및 인증서 발급 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    # Certbot 설치
    sudo apt update
    sudo apt install -y snapd
    sudo snap install core; sudo snap refresh core
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot

    # 인증서 발급 (Nginx 플러그인 사용)
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    echo "✅ SSL 인증서 발급 완료"
EOF

# 2. Nginx SSL 설정 업데이트
echo -e "${YELLOW}🌐 Nginx SSL 설정 업데이트 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    # SSL이 적용된 Nginx 설정 생성
    sudo tee /etc/nginx/sites-available/lovlechat > /dev/null << 'NGINX_CONF'
# HTTP to HTTPS 리다이렉트
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS 서버 설정
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL 인증서 설정
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 정적 파일 제공 (React 앱)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API 요청 프록시 (Next.js 백엔드)
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # 로그 설정
    access_log /var/log/nginx/lovlechat_access.log;
    error_log /var/log/nginx/lovlechat_error.log;
}
NGINX_CONF

    # Nginx 설정 테스트 및 재시작
    sudo nginx -t
    sudo systemctl reload nginx
    
    echo "✅ Nginx SSL 설정 완료"
EOF

# 3. 자동 갱신 설정
echo -e "${YELLOW}🔄 SSL 인증서 자동 갱신 설정 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    # Cron 작업 추가 (매일 2회 갱신 확인)
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && /usr/bin/systemctl reload nginx") | crontab -
    
    # 갱신 테스트
    sudo certbot renew --dry-run
    
    echo "✅ 자동 갱신 설정 완료"
EOF

# 4. 환경 변수 업데이트
echo -e "${YELLOW}⚙️  환경 변수 HTTPS로 업데이트 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    cd /home/ubuntu/lovlechat/backend
    
    # 환경 변수에서 HTTP를 HTTPS로 변경
    sed -i "s|FRONTEND_URL=http://|FRONTEND_URL=https://|g" .env
    sed -i "s|CORS_ORIGIN=http://|CORS_ORIGIN=https://|g" .env
    sed -i "s|your-ec2-ip|$DOMAIN|g" .env
    
    echo "✅ 환경 변수 업데이트 완료"
EOF

# 5. 애플리케이션 재시작
echo -e "${YELLOW}🔄 애플리케이션 재시작 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
    cd /home/ubuntu/lovlechat
    pm2 restart all
    echo "✅ 애플리케이션 재시작 완료"
EOF

# 6. SSL 상태 확인
echo -e "${YELLOW}🔍 SSL 설정 확인 중...${NC}"
ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << EOF
    echo "=== SSL 인증서 상태 ==="
    sudo certbot certificates
    
    echo ""
    echo "=== Nginx SSL 설정 테스트 ==="
    sudo nginx -t
    
    echo ""
    echo "=== 포트 443 확인 ==="
    sudo netstat -tlnp | grep :443
EOF

echo ""
echo -e "${GREEN}🎉 SSL 설정 완료!${NC}"
echo "------------------------------------"
echo -e "${BLUE}HTTPS URL: https://$DOMAIN${NC}"
echo ""
echo "SSL 관련 명령어:"
echo "- 인증서 상태: ssh -i $KEY_PATH $DEPLOY_USER@$EC2_IP 'sudo certbot certificates'"
echo "- 수동 갱신: ssh -i $KEY_PATH $DEPLOY_USER@$EC2_IP 'sudo certbot renew'"
echo "- Nginx 재시작: ssh -i $KEY_PATH $DEPLOY_USER@$EC2_IP 'sudo systemctl restart nginx'"
echo ""
echo -e "${YELLOW}⚠️  다음 사항들을 확인하세요:${NC}"
echo "- 도메인 DNS가 EC2 IP로 설정되어 있는지"
echo "- 보안 그룹에서 443 포트가 열려있는지"
echo "- 브라우저에서 HTTPS 접속이 되는지" 