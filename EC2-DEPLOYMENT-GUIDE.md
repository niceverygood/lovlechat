# 🚀 LovleChat EC2 배포 가이드

## 📋 목차
1. [사전 준비사항](#사전-준비사항)
2. [EC2 인스턴스 생성](#ec2-인스턴스-생성)
3. [보안 그룹 설정](#보안-그룹-설정)
4. [도메인 연결](#도메인-연결)
5. [자동 배포 실행](#자동-배포-실행)
6. [SSL 인증서 설정](#ssl-인증서-설정)
7. [모니터링 및 관리](#모니터링-및-관리)
8. [트러블슈팅](#트러블슈팅)

---

## 🛠️ 사전 준비사항

### 1. AWS 계정 및 권한
- AWS 계정 준비
- EC2, RDS 접근 권한
- Route 53 (도메인 사용시)

### 2. 로컬 환경
- Git 설치
- SSH 클라이언트
- 터미널/Command Line 도구

### 3. 현재 서비스 정보
- **Database**: AWS RDS MySQL 
- **Backend**: Next.js (포트 3002)
- **Frontend**: React (포트 3001)
- **현재 배포**: Vercel

---

## 🖥️ EC2 인스턴스 생성

### 1. EC2 인스턴스 생성
```bash
# AWS Console에서 EC2 생성
- AMI: Ubuntu Server 22.04 LTS
- Instance Type: t3.medium (권장) 또는 t3.small (최소)
- Storage: 20GB SSD (gp3)
- Security Group: 아래 포트 설정
```

### 2. 권장 사양
| 구분 | 최소 | 권장 | 프리미엄 |
|------|------|------|----------|
| **인스턴스** | t3.small | t3.medium | t3.large |
| **vCPU** | 2 | 2 | 2 |
| **메모리** | 2GB | 4GB | 8GB |
| **스토리지** | 20GB | 30GB | 50GB |
| **예상 비용/월** | $15-20 | $30-40 | $60-80 |

---

## 🔒 보안 그룹 설정

### 인바운드 규칙
| 타입 | 프로토콜 | 포트 | 소스 | 설명 |
|------|----------|------|------|------|
| SSH | TCP | 22 | 내 IP | SSH 접속 |
| HTTP | TCP | 80 | 0.0.0.0/0 | 웹 접속 |
| HTTPS | TCP | 443 | 0.0.0.0/0 | 보안 웹 접속 |
| Custom | TCP | 3001 | 0.0.0.0/0 | Frontend (임시) |
| Custom | TCP | 3002 | 0.0.0.0/0 | Backend API (임시) |

⚠️ **주의**: 배포 완료 후 3001, 3002 포트는 제거하고 80, 443만 사용하세요.

---

## 🌐 도메인 연결 (선택사항)

### 1. DNS 설정
```bash
# Route 53 또는 도메인 제공업체에서 설정
A 레코드: your-domain.com → EC2_PUBLIC_IP
A 레코드: www.your-domain.com → EC2_PUBLIC_IP
```

### 2. 무료 도메인 서비스
- **Freenom**: .tk, .ml, .ga, .cf 도메인
- **Duck DNS**: subdomain.duckdns.org
- **No-IP**: subdomain.hopto.org

---

## 🚀 자동 배포 실행

### 1. 배포 스크립트 실행 권한 설정
```bash
chmod +x deploy-ec2.sh
chmod +x setup-ssl.sh  
chmod +x monitor.sh
```

### 2. 기본 배포 실행
```bash
# IP 주소와 키 파일 경로를 실제 값으로 변경
./deploy-ec2.sh 1.2.3.4 ~/.ssh/your-key.pem
```

### 3. 환경 변수 설정
배포 중간에 환경 변수 설정이 필요합니다:

```bash
# EC2에 SSH 접속
ssh -i ~/.ssh/your-key.pem ubuntu@1.2.3.4

# 환경 변수 파일 생성
cd /home/ubuntu/lovlechat/backend
nano .env
```

환경 변수 템플릿:
```env
# env.template 파일 참고하여 실제 값으로 변경
NODE_ENV=production
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_DATABASE=lovlechat
OPENAI_API_KEY=your-openai-api-key
# ... 나머지 설정
```

### 4. 배포 완료 확인
```bash
# 브라우저에서 접속 테스트
http://your-ec2-ip

# 헬스 체크
./monitor.sh health 1.2.3.4 ~/.ssh/your-key.pem
```

---

## 🔒 SSL 인증서 설정

### 1. 도메인 연결 후 SSL 설정
```bash
# 실제 도메인으로 변경
./setup-ssl.sh your-domain.com 1.2.3.4 ~/.ssh/your-key.pem
```

### 2. SSL 설정 확인
```bash
# HTTPS 접속 테스트
https://your-domain.com

# SSL 등급 확인
https://www.ssllabs.com/ssltest/
```

---

## 📊 모니터링 및 관리

### 1. 시스템 상태 확인
```bash
./monitor.sh status 1.2.3.4 ~/.ssh/your-key.pem
```

### 2. 실시간 로그 확인
```bash
./monitor.sh logs 1.2.3.4 ~/.ssh/your-key.pem
```

### 3. 애플리케이션 재시작
```bash
./monitor.sh restart 1.2.3.4 ~/.ssh/your-key.pem
```

### 4. 코드 업데이트
```bash
./monitor.sh update 1.2.3.4 ~/.ssh/your-key.pem
```

### 5. 데이터베이스 백업
```bash
./monitor.sh backup 1.2.3.4 ~/.ssh/your-key.pem
```

### 6. 헬스 체크
```bash
./monitor.sh health 1.2.3.4 ~/.ssh/your-key.pem
```

---

## 🔧 트러블슈팅

### 🚨 자주 발생하는 문제들

#### 1. SSH 연결 실패
```bash
# 키 파일 권한 확인
chmod 400 ~/.ssh/your-key.pem

# 보안 그룹에서 22 포트 확인
# 퍼블릭 IP 확인
```

#### 2. 애플리케이션 시작 실패
```bash
# PM2 상태 확인
ssh -i ~/.ssh/your-key.pem ubuntu@1.2.3.4
pm2 list
pm2 logs

# 환경 변수 확인
cd /home/ubuntu/lovlechat/backend
cat .env
```

#### 3. 데이터베이스 연결 실패
```bash
# RDS 보안 그룹 확인 (3306 포트)
# 환경 변수의 DB 정보 확인
# RDS 퍼블릭 접근 가능 설정 확인
```

#### 4. Nginx 설정 오류
```bash
ssh -i ~/.ssh/your-key.pem ubuntu@1.2.3.4
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx
```

#### 5. 메모리 부족
```bash
# 메모리 사용량 확인
./monitor.sh metrics 1.2.3.4 ~/.ssh/your-key.pem

# 스왑 메모리 추가
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 📞 지원 및 문의

#### 1. 로그 수집
```bash
# 전체 로그 수집 스크립트
./monitor.sh status 1.2.3.4 > system-status.log
./monitor.sh logs 1.2.3.4 > application-logs.log
```

#### 2. 성능 보고서
```bash
./monitor.sh metrics 1.2.3.4 > performance-report.log
```

---

## 📈 성능 최적화 팁

### 1. PM2 클러스터 모드
```bash
# ecosystem.config.js에서 instances: 'max' 설정
pm2 restart ecosystem.config.js
```

### 2. Nginx 캐싱 설정
```nginx
# 정적 파일 캐싱
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 데이터베이스 최적화
- RDS 성능 개선 모니터링
- 느린 쿼리 로그 분석
- 인덱스 최적화

---

## 💰 비용 최적화

### 1. 인스턴스 스케줄링
```bash
# 개발 환경용 - 밤 10시~아침 8시 중지
aws ec2 stop-instances --instance-ids i-1234567890abcdef0
aws ec2 start-instances --instance-ids i-1234567890abcdef0
```

### 2. 스토리지 최적화
```bash
# 로그 파일 정기 정리 (Cron 설정)
0 2 * * * /home/ubuntu/lovlechat/monitor.sh cleanup
```

### 3. CloudWatch 모니터링
- CPU 사용률 < 10% 지속시 인스턴스 다운사이징
- 트래픽 패턴 분석하여 Auto Scaling 고려

---

## 🎯 다음 단계

### 1. 프로덕션 준비
- [ ] CDN 설정 (CloudFront)
- [ ] 로드 밸런서 구성
- [ ] 자동 백업 시스템
- [ ] 모니터링 알림 설정

### 2. 보안 강화
- [ ] WAF (Web Application Firewall) 설정
- [ ] DDoS 보호
- [ ] 정기 보안 패치
- [ ] 침입 탐지 시스템

### 3. 확장성 고려
- [ ] Auto Scaling Group 설정
- [ ] 다중 AZ 배포
- [ ] 마이크로서비스 아키텍처 고려

---

*🎉 배포 완료를 축하합니다! EC2에서 안정적으로 운영되는 LovleChat을 만나보세요.* 