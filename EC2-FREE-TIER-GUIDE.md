# 🆓 LovleChat 프리 티어 EC2 배포 가이드

## 📊 프리 티어 스펙 최적화

### 현재 선택한 스펙 ✅
- **AMI**: Ubuntu Server 24.04 LTS (HVM), SSD Volume Type
- **인스턴스**: t2.micro (1 vCPU, 1GB RAM)
- **스토리지**: 30GB SSD (프리 티어 최대)
- **비용**: **완전 무료** (12개월간)

### LovleChat 호환성 검증 ✅
- ✅ Next.js 백엔드: 경량화 모드 지원
- ✅ React 프론트엔드: 정적 빌드 가능
- ✅ MySQL RDS: 별도 프리 티어 사용
- ✅ PM2 프로세스 관리: 메모리 최적화

---

## 🚀 프리 티어 전용 배포 명령어

### 1. 스펙 최적화된 배포
```bash
# 프리 티어 최적화 모드로 배포
./deploy-ec2.sh YOUR_EC2_IP ~/.ssh/your-key.pem --free-tier

# 또는 수동으로 메모리 제한 설정
./deploy-ec2.sh YOUR_EC2_IP ~/.ssh/your-key.pem
```

### 2. 최적화 설정 적용
- **PM2 메모리 제한**: 백엔드 512MB, 프론트엔드 256MB
- **스왑 메모리**: 1GB 스왑 파일 생성
- **Nginx 최적화**: worker_processes auto → 1
- **캐시 최적화**: 메모리 사용량 50% 절약

---

## 📈 성능 최적화 방법

### 스왑 메모리 설정 (필수!)
```bash
# 1GB 스왑 파일 생성으로 메모리 부족 해결
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### PM2 메모리 최적화
```javascript
// ecosystem.config.js (프리 티어 버전)
module.exports = {
  apps: [
    {
      name: 'lovlechat-backend',
      max_memory_restart: '512M',  // 메모리 제한
      instances: 1,                // 단일 인스턴스
      node_args: '--max-old-space-size=400'  // Node.js 메모리 제한
    },
    {
      name: 'lovlechat-frontend',
      max_memory_restart: '256M',  // 프론트엔드 메모리 제한
      instances: 1
    }
  ]
}
```

---

## ⚠️ 프리 티어 제한사항

### 성능 제한
- **동시 접속자**: 5-10명 권장 (최대 20명)
- **응답 속도**: 일반적으로 500ms-1s (최적화 시 300ms)
- **CPU 크레딧**: 지속적인 고사용량 시 성능 저하

### 메모리 관리
- **사용 가능**: ~800MB (시스템 200MB 예약)
- **권장 분배**: 백엔드 500MB + 프론트엔드 200MB + 여유 100MB
- **스왑 사용**: 메모리 부족 시 자동 스왑 활용

---

## 💡 비용 절약 팁

### 1. RDS 프리 티어 함께 사용
```bash
# RDS MySQL 프리 티어 (20GB)
- db.t3.micro 인스턴스
- 월 750시간 무료 (24시간 상시 운영 가능)
- 20GB 스토리지 + 20GB 백업
```

### 2. CloudWatch 모니터링
```bash
# 무료 지표 모니터링
- CPU 사용률
- 메모리 사용률  
- 네트워크 I/O
- 디스크 사용량
```

### 3. Elastic IP (선택사항)
```bash
# 고정 IP 주소 (월 $3-5)
# 도메인 연결 시 권장
```

---

## 🎯 프리 티어 최적 시나리오

### 완벽한 개발/테스트 환경 ✨
- **개인 프로젝트**: 완벽 지원
- **포트폴리오**: 훌륭한 성능
- **소규모 베타 테스트**: 10-20명 동시 접속 가능
- **학습용**: 실제 운영 환경 경험

### 업그레이드 계획
```bash
# 향후 확장 시
t2.micro → t3.small  ($16/월)
t3.small → t3.medium ($32/월)
```

---

## 🚀 지금 바로 배포하기!

### Step 1: EC2 생성 완료
✅ Ubuntu Server 24.04 LTS 선택 완료
✅ t2.micro 프리 티어 선택 완료

### Step 2: 보안 그룹 설정
```bash
인바운드 규칙:
- SSH (22): 내 IP
- HTTP (80): 0.0.0.0/0  
- HTTPS (443): 0.0.0.0/0
- Custom (3001): 0.0.0.0/0  # 프론트엔드
- Custom (3002): 0.0.0.0/0  # 백엔드
```

### Step 3: 키 페어 다운로드
```bash
# 키 페어 권한 설정
chmod 400 ~/.ssh/your-lovlechat-key.pem
```

### Step 4: 배포 실행
```bash
# 프리 티어 최적화 배포
./deploy-ec2.sh YOUR_EC2_IP ~/.ssh/your-lovlechat-key.pem
```

---

## 🎉 예상 결과

### 성능 지표
- **페이지 로딩**: 1-2초
- **채팅 응답**: 500ms-1s  
- **동시 접속**: 5-10명 쾌적
- **월간 비용**: **$0** (프리 티어)

### 12개월 후 비용
- **EC2 t2.micro**: ~$8.5/월
- **RDS db.t3.micro**: ~$12/월
- **총 비용**: ~$20/월 (매우 저렴!)

프리 티어로 충분히 시작해서 사용자가 늘어나면 업그레이드하는 것이 가장 경제적입니다! 🚀 