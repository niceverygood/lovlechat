-- 결제 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  imp_uid VARCHAR(255) NOT NULL UNIQUE COMMENT '아임포트 결제 고유ID',
  merchant_uid VARCHAR(255) NOT NULL COMMENT '가맹점 주문번호',
  userId VARCHAR(255) NOT NULL COMMENT '사용자 ID',
  amount INT NOT NULL COMMENT '결제 금액',
  heartCount INT NOT NULL COMMENT '구매한 하트 개수',
  status VARCHAR(50) NOT NULL DEFAULT 'completed' COMMENT '결제 상태',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '결제 시간',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시간',
  
  INDEX idx_user_id (userId),
  INDEX idx_imp_uid (imp_uid),
  INDEX idx_merchant_uid (merchant_uid),
  INDEX idx_created_at (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='결제 기록 테이블'; 