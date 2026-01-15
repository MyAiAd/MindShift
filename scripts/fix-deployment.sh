#!/usr/bin/env bash

# Quick fix script - SSH and diagnose/fix the issue
SERVER="deploy@77.42.72.2"
APP_PATH="/opt/mind-shift/app"

echo "🔧 Connecting to server and fixing the issue..."
echo ""

ssh $SERVER << 'ENDSSH'
echo "📊 Checking PM2 status..."
pm2 status
echo ""

echo "📋 Checking recent logs..."
pm2 logs --lines 20 --nostream
echo ""

echo "🔄 Attempting rebuild and restart..."
cd /opt/mind-shift/app
git pull
npm install
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Restarting..."
    pm2 restart all
    echo "✅ App restarted!"
else
    echo "❌ Build failed! Showing error..."
    npm run build 2>&1 | tail -50
fi

echo ""
echo "📊 Final PM2 status:"
pm2 status
ENDSSH

echo ""
echo "Testing site..."
sleep 3
curl -I https://mind-shift.click

