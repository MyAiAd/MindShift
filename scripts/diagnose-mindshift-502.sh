#!/usr/bin/env bash

#############################################
# MindShift 502 Diagnostic Tool
# Customized for your deployment
#############################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Your actual domains
MAIN_DOMAIN="mind-shift.click"
API_DOMAIN="api.mind-shift.click"
SERVER_IP="77.42.72.2"
APP_PATH="/opt/mind-shift/app"
KOKORO_PATH="/opt/mind-shift/kokoro"

echo -e "${BLUE}🔍 MindShift 502 Diagnostic Tool${NC}"
echo "=========================================="
echo ""
echo "Domains:"
echo "  Main: https://$MAIN_DOMAIN"
echo "  API:  https://$API_DOMAIN"
echo "  IP:   $SERVER_IP"
echo ""
echo "=========================================="
echo ""

# Test 1: Check main site
echo -e "${YELLOW}[1/8] Testing main site (mind-shift.click)...${NC}"
MAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://$MAIN_DOMAIN)
if [ "$MAIN_STATUS" = "200" ] || [ "$MAIN_STATUS" = "301" ] || [ "$MAIN_STATUS" = "302" ]; then
    echo -e "${GREEN}✓ Main site responding (HTTP $MAIN_STATUS)${NC}"
else
    echo -e "${RED}✗ Main site FAILED (HTTP $MAIN_STATUS)${NC}"
    if [ "$MAIN_STATUS" = "502" ]; then
        echo "  → 502 Bad Gateway - Origin server issue"
    elif [ "$MAIN_STATUS" = "000" ]; then
        echo "  → Timeout - Server not responding"
    fi
fi
echo ""

# Test 2: Check API
echo -e "${YELLOW}[2/8] Testing API (api.mind-shift.click)...${NC}"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://$API_DOMAIN/health)
if [ "$API_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ API responding (HTTP $API_STATUS)${NC}"
    API_RESPONSE=$(curl -s https://$API_DOMAIN/health)
    echo "  Response: $API_RESPONSE"
else
    echo -e "${RED}✗ API FAILED (HTTP $API_STATUS)${NC}"
    if [ "$API_STATUS" = "502" ]; then
        echo "  → 502 Bad Gateway - Kokoro not responding"
    fi
fi
echo ""

# Test 3: Direct server check (bypass Cloudflare)
echo -e "${YELLOW}[3/8] Testing direct server connection...${NC}"
DIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --resolve $MAIN_DOMAIN:443:$SERVER_IP https://$MAIN_DOMAIN)
if [ "$DIRECT_STATUS" = "200" ] || [ "$DIRECT_STATUS" = "301" ]; then
    echo -e "${GREEN}✓ Direct connection works (HTTP $DIRECT_STATUS)${NC}"
    echo "  → Server is UP, issue is between Cloudflare and origin"
else
    echo -e "${RED}✗ Direct connection FAILED (HTTP $DIRECT_STATUS)${NC}"
    echo "  → Server might be down or not responding"
fi
echo ""

# Test 4: Check if you can SSH
echo -e "${YELLOW}[4/8] Testing SSH connectivity...${NC}"
if timeout 5 bash -c "echo >/dev/tcp/$SERVER_IP/22" 2>/dev/null; then
    echo -e "${GREEN}✓ SSH port (22) is open${NC}"
    echo "  → You can SSH in to check: ssh deploy@$SERVER_IP"
else
    echo -e "${RED}✗ Cannot reach SSH port${NC}"
    echo "  → Server might be completely down"
fi
echo ""

# Test 5: DNS check
echo -e "${YELLOW}[5/8] Checking DNS records...${NC}"
MAIN_DNS=$(dig +short $MAIN_DOMAIN | grep -v '\.$' | head -1)
API_DNS=$(dig +short $API_DOMAIN | grep -v '\.$' | head -1)
echo "  Main DNS: $MAIN_DNS"
echo "  API DNS:  $API_DNS"
if [ "$MAIN_DNS" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}  ⚠️  Main domain DNS doesn't match expected IP!${NC}"
fi
if [ "$API_DNS" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}  ⚠️  API domain DNS doesn't match expected IP!${NC}"
fi
echo ""

# Test 6: Check Cloudflare headers
echo -e "${YELLOW}[6/8] Checking Cloudflare configuration...${NC}"
CF_HEADERS=$(curl -sI https://$MAIN_DOMAIN)
if echo "$CF_HEADERS" | grep -q "cf-ray"; then
    CF_RAY=$(echo "$CF_HEADERS" | grep -i "cf-ray" | cut -d: -f2 | tr -d ' \r')
    echo -e "${GREEN}✓ Cloudflare is proxying${NC}"
    echo "  CF-RAY: $CF_RAY"
else
    echo -e "${YELLOW}⚠️  Not proxied through Cloudflare${NC}"
fi
echo ""

# Test 7: Check ports
echo -e "${YELLOW}[7/8] Testing server ports...${NC}"
if timeout 3 bash -c "echo >/dev/tcp/$SERVER_IP/80" 2>/dev/null; then
    echo -e "${GREEN}✓ Port 80 (HTTP) is open${NC}"
else
    echo -e "${RED}✗ Port 80 is NOT accessible${NC}"
fi

if timeout 3 bash -c "echo >/dev/tcp/$SERVER_IP/443" 2>/dev/null; then
    echo -e "${GREEN}✓ Port 443 (HTTPS) is open${NC}"
else
    echo -e "${RED}✗ Port 443 is NOT accessible${NC}"
fi
echo ""

# Test 8: Check if deployed
echo -e "${YELLOW}[8/8] Checking deployment...${NC}"
LATEST_COMMIT=$(git -C . rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  Local commit: $LATEST_COMMIT"
echo "  Expected paths:"
echo "    App: $APP_PATH"
echo "    Kokoro: $KOKORO_PATH"
echo ""

# Summary
echo "=========================================="
echo -e "${BLUE}📋 Diagnosis Summary${NC}"
echo "=========================================="
echo ""

if [ "$MAIN_STATUS" = "502" ]; then
    echo -e "${RED}🚨 502 Bad Gateway detected${NC}"
    echo ""
    echo "Most likely causes:"
    echo ""
    echo "1. ${YELLOW}PM2 app crashed/not running${NC}"
    echo "   Check: ssh deploy@$SERVER_IP 'pm2 status'"
    echo "   Fix:   ssh deploy@$SERVER_IP 'pm2 restart all'"
    echo ""
    echo "2. ${YELLOW}Caddy not running or misconfigured${NC}"
    echo "   Check: ssh deploy@$SERVER_IP 'sudo systemctl status caddy'"
    echo "   Fix:   ssh deploy@$SERVER_IP 'sudo systemctl restart caddy'"
    echo ""
    echo "3. ${YELLOW}App failed to build after deployment${NC}"
    echo "   Check: ssh deploy@$SERVER_IP 'cd $APP_PATH && pm2 logs'"
    echo "   Fix:   ssh deploy@$SERVER_IP 'cd $APP_PATH && npm run build && pm2 restart all'"
    echo ""
    echo "4. ${YELLOW}Kokoro container stopped${NC}"
    echo "   Check: ssh deploy@$SERVER_IP 'docker ps'"
    echo "   Fix:   ssh deploy@$SERVER_IP 'cd $KOKORO_PATH && docker-compose up -d'"
    echo ""
elif [ "$MAIN_STATUS" = "000" ]; then
    echo -e "${RED}🚨 Server timeout - not responding at all${NC}"
    echo ""
    echo "Possible causes:"
    echo "  - Server completely down"
    echo "  - Firewall blocking connections"
    echo "  - Network issue"
    echo ""
elif [ "$MAIN_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Everything looks good!${NC}"
    echo ""
    echo "Your site is working correctly."
else
    echo -e "${YELLOW}⚠️  Unexpected status: $MAIN_STATUS${NC}"
fi

echo "=========================================="
echo ""
echo "Quick fixes to try:"
echo ""
echo "1. ${BLUE}Restart everything:${NC}"
echo "   ssh deploy@$SERVER_IP '/opt/mind-shift/deploy-all.sh'"
echo ""
echo "2. ${BLUE}Check logs:${NC}"
echo "   ssh deploy@$SERVER_IP 'pm2 logs --lines 50'"
echo ""
echo "3. ${BLUE}Manual restart:${NC}"
echo "   ssh deploy@$SERVER_IP 'pm2 restart all && sudo systemctl restart caddy'"
echo ""
echo "4. ${BLUE}Check what's running:${NC}"
echo "   ssh deploy@$SERVER_IP 'pm2 list && docker ps'"
echo ""

