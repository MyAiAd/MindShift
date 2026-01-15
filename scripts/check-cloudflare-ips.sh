#!/usr/bin/env bash

#############################################
# Cloudflare IP Checker
# Verifies your firewall has current CF IPs
#############################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔍 Cloudflare IP Verification${NC}"
echo "=========================================="

# Fetch current Cloudflare IPs
echo "📡 Fetching latest Cloudflare IP ranges..."
CF_IPV4=$(curl -s https://www.cloudflare.com/ips-v4)
CF_IPV6=$(curl -s https://www.cloudflare.com/ips-v6)

if [ -z "$CF_IPV4" ]; then
    echo -e "${RED}❌ Failed to fetch Cloudflare IPs${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Latest Cloudflare IPs fetched${NC}"
echo ""

# Check firewall rules
echo "🔍 Checking your firewall rules..."
echo ""

MISSING_IPV4=()
FOUND_IPV4=()

if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    echo "Using UFW..."
    RULES=$(ufw status numbered)
    
    while IFS= read -r ip; do
        if echo "$RULES" | grep -q "$ip"; then
            FOUND_IPV4+=("$ip")
        else
            MISSING_IPV4+=("$ip")
        fi
    done <<< "$CF_IPV4"
    
elif command -v iptables &> /dev/null; then
    echo "Using iptables..."
    RULES=$(iptables -S)
    
    while IFS= read -r ip; do
        if echo "$RULES" | grep -q "$ip"; then
            FOUND_IPV4+=("$ip")
        else
            MISSING_IPV4+=("$ip")
        fi
    done <<< "$CF_IPV4"
else
    echo -e "${RED}❌ No firewall detected${NC}"
    exit 1
fi

# Report results
echo ""
echo "📊 Results:"
echo "=========================================="
echo -e "${GREEN}✓ Found: ${#FOUND_IPV4[@]} ranges${NC}"
if [ ${#MISSING_IPV4[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing: ${#MISSING_IPV4[@]} ranges${NC}"
    echo ""
    echo -e "${YELLOW}Missing IP ranges:${NC}"
    for ip in "${MISSING_IPV4[@]}"; do
        echo "  ❌ $ip"
    done
    echo ""
    echo -e "${YELLOW}⚠️  Your firewall is OUTDATED!${NC}"
    echo "Run the update script to fix:"
    echo "  sudo ./scripts/update-cloudflare-ips.sh"
else
    echo -e "${GREEN}✅ All Cloudflare IPs are whitelisted!${NC}"
fi

echo ""

