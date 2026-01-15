#!/bin/bash

#############################################
# Cloudflare IP Updater for UFW/iptables
# Automatically fetches latest Cloudflare IPs
# and updates firewall rules
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔥 Cloudflare IP Updater${NC}"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Detect firewall type
FIREWALL=""
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    FIREWALL="ufw"
    echo -e "${GREEN}✓ Detected: UFW${NC}"
elif command -v iptables &> /dev/null; then
    FIREWALL="iptables"
    echo -e "${GREEN}✓ Detected: iptables${NC}"
else
    echo -e "${RED}❌ No supported firewall found (UFW or iptables)${NC}"
    exit 1
fi

# Fetch current Cloudflare IPs
echo ""
echo "📡 Fetching latest Cloudflare IP ranges..."
CF_IPV4=$(curl -s https://www.cloudflare.com/ips-v4)
CF_IPV6=$(curl -s https://www.cloudflare.com/ips-v6)

if [ -z "$CF_IPV4" ]; then
    echo -e "${RED}❌ Failed to fetch Cloudflare IPv4 ranges${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Fetched IPv4 ranges:${NC}"
echo "$CF_IPV4" | sed 's/^/  /'

if [ -n "$CF_IPV6" ]; then
    echo -e "${GREEN}✓ Fetched IPv6 ranges:${NC}"
    echo "$CF_IPV6" | sed 's/^/  /'
fi

# Backup current rules
echo ""
echo "💾 Backing up current firewall rules..."
BACKUP_DIR="/root/firewall-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ "$FIREWALL" = "ufw" ]; then
    ufw status numbered > "$BACKUP_DIR/ufw-rules-$TIMESTAMP.txt"
    echo -e "${GREEN}✓ Backed up to: $BACKUP_DIR/ufw-rules-$TIMESTAMP.txt${NC}"
else
    iptables-save > "$BACKUP_DIR/iptables-rules-$TIMESTAMP.txt"
    ip6tables-save > "$BACKUP_DIR/ip6tables-rules-$TIMESTAMP.txt" 2>/dev/null || true
    echo -e "${GREEN}✓ Backed up to: $BACKUP_DIR/iptables-rules-$TIMESTAMP.txt${NC}"
fi

# Remove old Cloudflare rules (to avoid duplicates)
echo ""
echo "🧹 Removing old Cloudflare rules..."

if [ "$FIREWALL" = "ufw" ]; then
    # UFW: Delete old Cloudflare rules
    for ip in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
        ufw delete allow from $ip 2>/dev/null || true
    done
    echo -e "${GREEN}✓ Cleaned old rules${NC}"
else
    # iptables: Remove old Cloudflare rules by comment
    iptables -S | grep "CLOUDFLARE" | sed 's/-A //' | while read rule; do
        iptables -D $rule 2>/dev/null || true
    done
    echo -e "${GREEN}✓ Cleaned old rules${NC}"
fi

# Add new Cloudflare rules
echo ""
echo "➕ Adding new Cloudflare IP rules..."

if [ "$FIREWALL" = "ufw" ]; then
    # UFW: Add rules for each IP
    while IFS= read -r ip; do
        echo "  Adding: $ip"
        ufw allow from "$ip" to any port 80 proto tcp comment 'Cloudflare IPv4' >/dev/null
        ufw allow from "$ip" to any port 443 proto tcp comment 'Cloudflare IPv4' >/dev/null
    done <<< "$CF_IPV4"
    
    if [ -n "$CF_IPV6" ]; then
        while IFS= read -r ip; do
            echo "  Adding: $ip"
            ufw allow from "$ip" to any port 80 proto tcp comment 'Cloudflare IPv6' >/dev/null
            ufw allow from "$ip" to any port 443 proto tcp comment 'Cloudflare IPv6' >/dev/null
        done <<< "$CF_IPV6"
    fi
    
    echo ""
    echo "🔄 Reloading UFW..."
    ufw reload
    
else
    # iptables: Add rules with comment
    while IFS= read -r ip; do
        echo "  Adding: $ip"
        iptables -I INPUT -p tcp --dport 80 -s "$ip" -m comment --comment "CLOUDFLARE-IPv4" -j ACCEPT
        iptables -I INPUT -p tcp --dport 443 -s "$ip" -m comment --comment "CLOUDFLARE-IPv4" -j ACCEPT
    done <<< "$CF_IPV4"
    
    if [ -n "$CF_IPV6" ]; then
        while IFS= read -r ip; do
            echo "  Adding: $ip"
            ip6tables -I INPUT -p tcp --dport 80 -s "$ip" -m comment --comment "CLOUDFLARE-IPv6" -j ACCEPT
            ip6tables -I INPUT -p tcp --dport 443 -s "$ip" -m comment --comment "CLOUDFLARE-IPv6" -j ACCEPT
        done <<< "$CF_IPV6"
    fi
    
    # Save rules
    if [ -f /etc/iptables/rules.v4 ]; then
        iptables-save > /etc/iptables/rules.v4
        ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
    elif [ -f /etc/sysconfig/iptables ]; then
        service iptables save
        service ip6tables save 2>/dev/null || true
    fi
fi

echo ""
echo -e "${GREEN}✅ Cloudflare IPs updated successfully!${NC}"
echo ""
echo "📊 Summary:"
echo "  • IPv4 ranges: $(echo "$CF_IPV4" | wc -l)"
echo "  • IPv6 ranges: $(echo "$CF_IPV6" | wc -l)"
echo "  • Firewall: $FIREWALL"
echo "  • Backup: $BACKUP_DIR/*-$TIMESTAMP.txt"
echo ""
echo -e "${YELLOW}💡 Tip: Add this to cron to auto-update weekly:${NC}"
echo "   sudo crontab -e"
echo "   0 2 * * 0 /path/to/update-cloudflare-ips.sh >> /var/log/cloudflare-ip-update.log 2>&1"
echo ""

