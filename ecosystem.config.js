module.exports = {
  apps: [
    {
      name: 'lovlechat-backend',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/lovlechat/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',  // 프리 티어 최적화
      node_args: '--max-old-space-size=400',  // Node.js 메모리 제한
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'lovlechat-frontend',
      script: 'serve',
      args: ['-s', 'build', '-l', '3001'],
      cwd: '/home/ubuntu/lovlechat/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',  // 프리 티어 최적화
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log', 
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-ec2-ip-address'],
      key: '~/.ssh/lovlechat-key.pem',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/LovleChat.git',
      path: '/home/ubuntu/lovlechat',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 