#!/usr/bin/env bash

#############################################
# 502 Bad Gateway Diagnostic Tool
# Checks common causes of Cloudflare 502s
#############################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 502 Bad Gateway Diagnostic Tool${NC}"
echo "=========================================="
echo ""

# Get domain from user or use default
read -p "Enter your domain (e.g., mind-shift.click): " DOMAIN
DOMAIN=${DOMAIN:-mind-shift.click}

echo ""
echo -e "${BLUE}Testing: $DOMAIN${NC}"
echo "=========================================="
echo ""

# Test 1: Check if origin server is responding
echo -e "${YELLOW}[1/7] Checking if origin server is responding...${NC}"
if curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://$DOMAIN | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Server is responding${NC}"
else
    echo -e "${RED}✗ Server is NOT responding or timing out${NC}"
    echo "  Possible causes:"
    echo "  - Web server (nginx/apache) not running"
    echo "  - Application crashed"
    echo "  - Wrong origin IP in Cloudflare"
fi
echo ""

# Test 2: Check DNS resolution
echo -e "${YELLOW}[2/7] Checking DNS resolution...${NC}"
DIG_RESULT=$(dig +short $DOMAIN)
if [ -n "$DIG_RESULT" ]; then
    echo -e "${GREEN}✓ DNS resolves to:${NC}"
    echo "$DIG_RESULT" | sed 's/^/  /'
else
    echo -e "${RED}✗ DNS not resolving${NC}"
fi
echo ""

# Test 3: Check if server accepts connections on port 443
echo -e "${YELLOW}[3/7] Checking HTTPS port (443)...${NC}"
ORIGIN_IP=$(dig +short $DOMAIN | head -n1)
if [ -n "$ORIGIN_IP" ]; then
    if timeout 5 bash -c "echo >/dev/tcp/$ORIGIN_IP/443" 2>/dev/null; then
        echo -e "${GREEN}✓ Port 443 is open and accepting connections${NC}"
    else
        echo -e "${RED}✗ Port 443 is NOT accepting connections${NC}"
        echo "  Possible causes:"
        echo "  - Firewall blocking port 443"
        echo "  - Web server not listening on 443"
        echo "  - SSL certificate issue"
    fi
fi
echo ""

# Test 4: Check HTTP port
echo -e "${YELLOW}[4/7] Checking HTTP port (80)...${NC}"
if [ -n "$ORIGIN_IP" ]; then
    if timeout 5 bash -c "echo >/dev/tcp/$ORIGIN_IP/80" 2>/dev/null; then
        echo -e "${GREEN}✓ Port 80 is open${NC}"
    else
        echo -e "${RED}✗ Port 80 is NOT accepting connections${NC}"
    fi
fi
echo ""

# Test 5: Check Cloudflare SSL/TLS mode
echo -e "${YELLOW}[5/7] Checking SSL/TLS...${NC}"
SSL_RESPONSE=$(curl -sI https://$DOMAIN 2>&1)
if echo "$SSL_RESPONSE" | grep -q "cloudflare"; then
    echo -e "${GREEN}✓ Cloudflare is proxying (orange cloud)${NC}"
    echo "  Check your SSL/TLS mode in Cloudflare dashboard:"
    echo "  - Should be 'Full' or 'Full (strict)'"
    echo "  - NOT 'Flexible'"
else
    echo -e "${YELLOW}⚠ Not proxied through Cloudflare (gray cloud)${NC}"
fi
echo ""

# Test 6: Try direct connection to origin
echo -e "${YELLOW}[6/7] Testing direct connection to origin...${NC}"
if [ -n "$ORIGIN_IP" ]; then
    DIRECT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://$ORIGIN_IP 2>&1)
    if [ "$DIRECT_RESPONSE" = "200" ] || [ "$DIRECT_RESPONSE" = "301" ] || [ "$DIRECT_RESPONSE" = "302" ]; then
        echo -e "${GREEN}✓ Direct connection works (HTTP code: $DIRECT_RESPONSE)${NC}"
        echo "  ⚠️  This means your server is UP but Cloudflare can't reach it"
        echo "  Check: Origin IP in Cloudflare, SSL/TLS mode, firewall rules"
    else
        echo -e "${RED}✗ Direct connection failed (HTTP code: $DIRECT_RESPONSE)${NC}"
        echo "  Your server might be down or not responding"
    fi
fi
echo ""

# Test 7: Check for common error patterns
echo -e "${YELLOW}[7/7] Additional diagnostics...${NC}"
FULL_RESPONSE=$(curl -sI https://$DOMAIN)
if echo "$FULL_RESPONSE" | grep -q "cf-ray"; then
    CF_RAY=$(echo "$FULL_RESPONSE" | grep -i "cf-ray" | cut -d: -f2 | tr -d ' \r')
    echo -e "${BLUE}  Cloudflare Ray ID: $CF_RAY${NC}"
    echo "  Use this in Cloudflare support if needed"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${BLUE}📋 Diagnosis Summary${NC}"
echo "=========================================="
echo ""
echo "Common 502 causes when firewall is OK:"
echo ""
echo "1. ${YELLOW}Origin server down/not responding${NC}"
echo "   Fix: Check if nginx/apache running, check app logs"
echo "   SSH: sudo systemctl status nginx"
echo ""
echo "2. ${YELLOW}Wrong SSL/TLS mode in Cloudflare${NC}"
echo "   Fix: Set to 'Full' or 'Full (strict)' in CF dashboard"
echo "   Dashboard → SSL/TLS → Overview"
echo ""
echo "3. ${YELLOW}Wrong origin IP in Cloudflare${NC}"
echo "   Fix: Verify origin IP matches your server"
echo "   Dashboard → DNS → Check A record"
echo ""
echo "4. ${YELLOW}Application crashed${NC}"
echo "   Fix: Check application logs"
echo "   SSH: sudo journalctl -u your-app -n 50"
echo ""
echo "5. ${YELLOW}Origin server rejecting Cloudflare${NC}"
echo "   Fix: Check origin server firewall/security"
echo ""

echo "=========================================="
echo ""
echo "Next steps:"
echo "1. SSH into your server: ssh root@$ORIGIN_IP"
echo "2. Check web server: sudo systemctl status nginx"
echo "3. Check app logs: sudo journalctl -xe"
echo "4. Check Cloudflare SSL/TLS settings"
echo ""

