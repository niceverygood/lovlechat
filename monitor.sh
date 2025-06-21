#!/bin/bash

# 📊 LovleChat EC2 모니터링 및 관리 스크립트
# 사용법: ./monitor.sh [ACTION] [EC2_IP] [KEY_PATH]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 변수 설정
ACTION=${1:-"status"}
EC2_IP=${2:-"your-ec2-ip"}
KEY_PATH=${3:-"~/.ssh/lovlechat-key.pem"}
DEPLOY_USER="ubuntu"
APP_DIR="/home/ubuntu/lovlechat"

# 함수 정의
show_help() {
    echo -e "${BLUE}📊 LovleChat EC2 모니터링 도구${NC}"
    echo ""
    echo "사용법: ./monitor.sh [ACTION] [EC2_IP] [KEY_PATH]"
    echo ""
    echo "Actions:"
    echo "  status     - 전체 시스템 상태 확인 (기본값)"
    echo "  logs       - 실시간 로그 확인"
    echo "  restart    - 애플리케이션 재시작"
    echo "  update     - 코드 업데이트 및 재배포"
    echo "  backup     - 데이터베이스 백업"
    echo "  health     - 헬스 체크"
    echo "  cleanup    - 로그 정리"
    echo "  metrics    - 성능 지표 확인"
    echo ""
    echo "예시:"
    echo "  ./monitor.sh status 1.2.3.4 ~/.ssh/key.pem"
    echo "  ./monitor.sh logs 1.2.3.4"
    echo "  ./monitor.sh restart 1.2.3.4"
}

check_status() {
    echo -e "${CYAN}📊 시스템 상태 확인${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        echo "=== 📅 시스템 정보 ==="
        echo "현재 시간: $(date)"
        echo "업타임: $(uptime -p)"
        echo "로드 평균: $(uptime | awk -F'load average:' '{print $2}')"
        
        echo ""
        echo "=== 💾 메모리 사용량 ==="
        free -h
        
        echo ""
        echo "=== 💽 디스크 사용량 ==="
        df -h /
        
        echo ""
        echo "=== 🔄 PM2 프로세스 상태 ==="
        pm2 list
        
        echo ""
        echo "=== 🌐 Nginx 상태 ==="
        sudo systemctl status nginx --no-pager -l | head -10
        
        echo ""
        echo "=== 🔌 포트 상태 ==="
        sudo netstat -tlnp | grep -E ':80|:443|:3001|:3002'
        
        echo ""
        echo "=== 🔥 Top 프로세스 (CPU 사용량) ==="
        ps aux --sort=-%cpu | head -10
EOF
}

show_logs() {
    echo -e "${CYAN}📋 실시간 로그 확인${NC}"
    echo "Ctrl+C로 종료하세요"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        echo "=== Backend 로그 (최근 20줄) ==="
        tail -n 20 /home/ubuntu/lovlechat/logs/backend-combined.log 2>/dev/null || echo "로그 파일 없음"
        
        echo ""
        echo "=== Frontend 로그 (최근 20줄) ==="
        tail -n 20 /home/ubuntu/lovlechat/logs/frontend-combined.log 2>/dev/null || echo "로그 파일 없음"
        
        echo ""
        echo "=== Nginx 에러 로그 (최근 10줄) ==="
        sudo tail -n 10 /var/log/nginx/lovlechat_error.log 2>/dev/null || echo "로그 파일 없음"
        
        echo ""
        echo "=== 실시간 PM2 로그 ==="
        pm2 logs --lines 50
EOF
}

restart_app() {
    echo -e "${YELLOW}🔄 애플리케이션 재시작 중...${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        cd /home/ubuntu/lovlechat
        
        echo "PM2 프로세스 재시작 중..."
        pm2 restart all
        
        echo "Nginx 재시작 중..."
        sudo systemctl restart nginx
        
        sleep 5
        
        echo "상태 확인..."
        pm2 list
        
        echo "✅ 재시작 완료"
EOF
}

update_code() {
    echo -e "${YELLOW}📦 코드 업데이트 및 재배포 중...${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        cd /home/ubuntu/lovlechat
        
        echo "Git 변경사항 확인..."
        git fetch origin
        
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse origin/main)
        
        if [ "$LOCAL" = "$REMOTE" ]; then
            echo "이미 최신 버전입니다."
            exit 0
        fi
        
        echo "새로운 변경사항 발견, 업데이트 시작..."
        
        # 백업
        cp -r . ../lovlechat_backup_$(date +%Y%m%d_%H%M%S)
        
        # 코드 업데이트
        git pull origin main
        
        # 백엔드 빌드
        cd backend
        npm install
        npm run build
        
        # 프론트엔드 빌드
        cd ../frontend
        npm install
        npm run build
        
        # 애플리케이션 재시작
        cd ..
        pm2 restart all
        
        echo "✅ 업데이트 완료"
EOF
}

backup_database() {
    echo -e "${PURPLE}💾 데이터베이스 백업 중...${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        cd /home/ubuntu/lovlechat
        
        # 백업 디렉토리 생성
        mkdir -p backups
        
        # 환경 변수 로드
        source backend/.env
        
        # MySQL 덤프 생성
        BACKUP_FILE="backups/lovlechat_backup_$(date +%Y%m%d_%H%M%S).sql"
        
        mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_DATABASE > $BACKUP_FILE
        
        # 압축
        gzip $BACKUP_FILE
        
        echo "백업 완료: $BACKUP_FILE.gz"
        
        # 7일 이상 된 백업 파일 삭제
        find backups/ -name "*.sql.gz" -mtime +7 -delete
        
        echo "백업 파일 목록:"
        ls -la backups/
EOF
}

health_check() {
    echo -e "${GREEN}🏥 헬스 체크 실행${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        echo "=== 🔍 서비스 접속 테스트 ==="
        
        # 프론트엔드 체크
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
            echo "✅ Frontend (3001) - OK"
        else
            echo "❌ Frontend (3001) - FAIL"
        fi
        
        # 백엔드 API 체크
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/test-db | grep -q "200"; then
            echo "✅ Backend API (3002) - OK"
        else
            echo "❌ Backend API (3002) - FAIL"
        fi
        
        # Nginx 체크
        if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200"; then
            echo "✅ Nginx (80) - OK"
        else
            echo "❌ Nginx (80) - FAIL"
        fi
        
        echo ""
        echo "=== 📊 리소스 체크 ==="
        
        # 메모리 사용량 체크
        MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ $MEM_USAGE -lt 80 ]; then
            echo "✅ 메모리 사용량: ${MEM_USAGE}% - OK"
        else
            echo "⚠️ 메모리 사용량: ${MEM_USAGE}% - WARNING"
        fi
        
        # 디스크 사용량 체크
        DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
        if [ $DISK_USAGE -lt 80 ]; then
            echo "✅ 디스크 사용량: ${DISK_USAGE}% - OK"
        else
            echo "⚠️ 디스크 사용량: ${DISK_USAGE}% - WARNING"
        fi
        
        # 로드 평균 체크
        LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        echo "📈 로드 평균: $LOAD"
EOF
}

cleanup_logs() {
    echo -e "${YELLOW}🧹 로그 정리 중...${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        echo "=== PM2 로그 정리 ==="
        pm2 flush
        
        echo "=== Nginx 로그 정리 ==="
        sudo truncate -s 0 /var/log/nginx/lovlechat_access.log
        sudo truncate -s 0 /var/log/nginx/lovlechat_error.log
        
        echo "=== 시스템 로그 정리 ==="
        sudo journalctl --vacuum-time=7d
        
        echo "=== 임시 파일 정리 ==="
        sudo apt autoremove -y
        sudo apt autoclean
        
        echo "✅ 정리 완료"
        
        echo ""
        echo "=== 디스크 사용량 (정리 후) ==="
        df -h /
EOF
}

show_metrics() {
    echo -e "${CYAN}📈 성능 지표 확인${NC}"
    ssh -i "$KEY_PATH" "$DEPLOY_USER@$EC2_IP" << 'EOF'
        echo "=== 🖥️ CPU 정보 ==="
        lscpu | grep -E "CPU\(s\)|Model name|CPU MHz"
        
        echo ""
        echo "=== 📊 메모리 상세 정보 ==="
        free -h
        cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|Cached|Buffers"
        
        echo ""
        echo "=== 🌐 네트워크 통계 ==="
        cat /proc/net/dev | grep -E "eth0|ens"
        
        echo ""
        echo "=== 📈 PM2 모니터링 ==="
        pm2 monit --no-interaction | head -20
        
        echo ""
        echo "=== 🔥 Top 프로세스 (메모리 사용량) ==="
        ps aux --sort=-%mem | head -10
        
        echo ""
        echo "=== 📱 IO 통계 ==="
        iostat 1 2 | tail -20
EOF
}

# 메인 실행 로직
case $ACTION in
    "help"|"-h"|"--help")
        show_help
        ;;
    "status")
        check_status
        ;;
    "logs")
        show_logs
        ;;
    "restart")
        restart_app
        ;;
    "update")
        update_code
        ;;
    "backup")
        backup_database
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        cleanup_logs
        ;;
    "metrics")
        show_metrics
        ;;
    *)
        echo -e "${RED}❌ 알 수 없는 액션: $ACTION${NC}"
        show_help
        exit 1
        ;;
esac 