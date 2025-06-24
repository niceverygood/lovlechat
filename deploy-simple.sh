#!/bin/bash

# Simple deployment script for EC2
echo "🚀 Starting LovleChat deployment..."

# Check if we're in the right directory
if [ ! -f "backend/index.js" ]; then
    echo "❌ Error: Not in LovleChat project directory"
    echo "Please run this script from /home/ubuntu/lovlechat"
    exit 1
fi

# Git pull
echo "📦 Pulling latest code from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed"
    exit 1
fi

# Navigate to backend
cd backend

# Install dependencies (production only)
echo "📚 Installing dependencies..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

# Restart PM2
echo "🔄 Restarting backend server..."
pm2 restart lovlechat-backend

if [ $? -ne 0 ]; then
    echo "⚠️  PM2 restart failed, trying to start..."
    pm2 start index.js --name lovlechat-backend
fi

# Check status
echo "📊 Checking server status..."
pm2 list | grep lovlechat-backend

echo "✅ Deployment completed!"
echo "Server should be running on port 3002" 