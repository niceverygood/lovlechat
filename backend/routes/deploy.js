const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const crypto = require('crypto');

// GitHub Webhook 시크릿 (환경변수로 설정)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'lovlechat-deploy-secret';

// GitHub Webhook 서명 검증
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

// POST /api/deploy/webhook - GitHub Webhook 처리
router.post('/webhook', (req, res) => {
  console.log('🚀 Deploy webhook received');
  
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // 시그니처 검증 (프로덕션에서는 활성화)
    if (process.env.NODE_ENV === 'production' && signature) {
      if (!verifySignature(payload, signature)) {
        console.log('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // main 브랜치에 push된 경우만 배포
    if (req.body.ref === 'refs/heads/main') {
      console.log('📦 Deploying to main branch...');
      
      // 배포 스크립트 실행
      const deployScript = `
        cd /home/ubuntu/lovlechat && \
        git pull origin main && \
        cd backend && \
        npm install --production && \
        pm2 restart lovlechat-backend || pm2 start index.js --name lovlechat-backend
      `;
      
      exec(deployScript, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Deploy error:', error);
          return res.status(500).json({ error: 'Deploy failed', details: error.message });
        }
        
        console.log('✅ Deploy completed');
        console.log('STDOUT:', stdout);
        if (stderr) console.log('STDERR:', stderr);
        
        res.json({ 
          success: true, 
          message: 'Deploy completed successfully',
          timestamp: new Date().toISOString()
        });
      });
    } else {
      console.log('ℹ️ Not main branch, skipping deploy');
      res.json({ message: 'Not main branch, skipping deploy' });
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

// POST /api/deploy/manual - 수동 배포 트리거
router.post('/manual', (req, res) => {
  console.log('🚀 Manual deploy triggered');
  
  const deployScript = `
    cd /home/ec2-user/lovlechat-backend && \
    git stash && \
    git pull origin main && \
    npm install --production && \
    pm2 restart lovlechat-backend || pm2 start index.js --name lovlechat-backend
  `;
  
  exec(deployScript, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Manual deploy error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Deploy failed', 
        details: error.message 
      });
    }
    
    console.log('✅ Manual deploy completed');
    console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    
    res.json({ 
      success: true, 
      message: 'Manual deploy completed successfully',
      timestamp: new Date().toISOString(),
      output: stdout
    });
  });
});

// POST /api/deploy/force - 강제 배포 (충돌 무시)
router.post('/force', (req, res) => {
  console.log('💪 Force deploy triggered - ignoring conflicts');
  
  const forceDeployScript = `
    cd /home/ec2-user/lovlechat-backend && \
    git reset --hard HEAD && \
    git clean -fd && \
    git pull origin main && \
    npm install --production && \
    pm2 restart lovlechat-backend || pm2 start index.js --name lovlechat-backend && \
    echo "Backend deployed successfully"
  `;
  
  exec(forceDeployScript, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Force deploy error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Force deploy failed', 
        details: error.message,
        stderr: stderr
      });
    }
    
    console.log('✅ Force deploy completed');
    console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    
    res.json({ 
      success: true, 
      message: 'Force deploy completed successfully',
      timestamp: new Date().toISOString(),
      output: stdout,
      stderr: stderr
    });
  });
});

// GET /api/deploy/status - 배포 상태 확인
router.get('/status', (req, res) => {
  exec('pm2 jlist', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to get PM2 status', 
        details: error.message 
      });
    }
    
    try {
      const processes = JSON.parse(stdout);
      const lovlechatProcess = processes.find(p => p.name === 'lovlechat-backend');
      
      res.json({
        pm2Status: lovlechatProcess ? {
          name: lovlechatProcess.name,
          status: lovlechatProcess.pm2_env.status,
          uptime: lovlechatProcess.pm2_env.pm_uptime,
          restarts: lovlechatProcess.pm2_env.restart_time,
          memory: lovlechatProcess.pm2_env.memory,
          cpu: lovlechatProcess.pm2_env.cpu
        } : null,
        serverTime: new Date().toISOString(),
        nodeVersion: process.version
      });
    } catch (parseError) {
      res.status(500).json({ 
        error: 'Failed to parse PM2 status', 
        details: parseError.message 
      });
    }
  });
});

module.exports = router; 