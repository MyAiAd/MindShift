#!/bin/bash

# ===============================================
# PRE-COMMIT SECURITY SCAN
# ===============================================
# This script prevents secrets from being committed to git
# Run this before every commit to ensure no sensitive data leaks

echo "🔍 Running comprehensive security scan..."

# Define patterns for secrets
SECRET_PATTERNS=(
    "kdxwfaynzemmdonkmttf"
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    "T3sla12e"
    "BFpp5r01coZhe4tET2K01hnb9aGuA9PueNKl"
    "bkQnInBlb8r4zJQBjINB-Gv5ZhOS05xESsRmbkS0uoo"
    "Jenny@MyAi.ad"
    "MyAi123"
)

# Define additional pattern categories
GENERIC_PATTERNS=(
    "sk_live_"
    "pk_live_"
    "AKIA[0-9A-Z]{16}"
    "eyJ[A-Za-z0-9-_=]+"
    "xox[baprs]-[0-9a-zA-Z]{10,48}"
    "ghp_[0-9a-zA-Z]{36}"
)

# Files to exclude from scanning
EXCLUDE_DIRS="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next"
EXCLUDE_FILES="--exclude=pre-commit-security-scan.sh --exclude=SECURITY_CHECKLIST.md --exclude=SETUP_SECURITY.md"

ERRORS_FOUND=0

# Function to check for specific patterns
check_pattern() {
    local pattern="$1"
    local description="$2"
    
    echo "  Checking for $description..."
    
    if grep -r "$pattern" $EXCLUDE_DIRS $EXCLUDE_FILES . > /dev/null 2>&1; then
        echo "  ❌ FOUND: $description"
        echo "  Files containing '$pattern':"
        grep -r "$pattern" $EXCLUDE_DIRS $EXCLUDE_FILES . | head -5
        ERRORS_FOUND=1
    else
        echo "  ✅ Clean: $description"
    fi
}

# Function to check for files that shouldn't exist
check_dangerous_files() {
    echo "  Checking for dangerous files..."
    
    DANGEROUS_FILES=(
        "*.env"
        "*.env.local"
        "*.env.production"
        "*environment-variables.txt"
        "*secrets*"
        "*credentials*"
        "*.pem"
        "*.key"
        "service-account*.json"
    )
    
    for pattern in "${DANGEROUS_FILES[@]}"; do
        if find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.git/*" | grep -q .; then
            echo "  ❌ FOUND: Dangerous file pattern: $pattern"
            find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.git/*"
            ERRORS_FOUND=1
        fi
    done
    
    if [ $ERRORS_FOUND -eq 0 ]; then
        echo "  ✅ Clean: No dangerous files found"
    fi
}

# Function to check .yoyo directory
check_yoyo_directory() {
    echo "  Checking for .yoyo directory..."
    
    if [ -d "./.yoyo" ]; then
        echo "  ❌ FOUND: .yoyo directory exists (contains backup snapshots)"
        echo "  This directory often contains copies of files with real secrets"
        ERRORS_FOUND=1
    else
        echo "  ✅ Clean: No .yoyo directory found"
    fi
}

# Main scanning logic
echo "🔍 Phase 1: Scanning for known secrets..."
check_pattern "kdxwfaynzemmdonkmttf" "Real Supabase project ID"
check_pattern "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" "JWT tokens"
check_pattern "T3sla12e" "Database password"
check_pattern "BFpp5r01coZhe4tET2K01hnb9aGuA9PueNKl" "VAPID public key"
check_pattern "bkQnInBlb8r4zJQBjINB-Gv5ZhOS05xESsRmbkS0uoo" "VAPID private key"
check_pattern "Jenny@MyAi.ad" "Real email address"
check_pattern "MyAi123" "Hardcoded password"

echo ""
echo "🔍 Phase 2: Scanning for generic secret patterns..."
check_pattern "sk_live_" "Live Stripe secret keys"
check_pattern "pk_live_" "Live Stripe public keys"
check_pattern "AKIA[0-9A-Z]{16}" "AWS access keys"
check_pattern "ghp_[0-9a-zA-Z]{36}" "GitHub personal access tokens"

echo ""
echo "🔍 Phase 3: Checking for dangerous files..."
check_dangerous_files

echo ""
echo "🔍 Phase 4: Checking for backup directories..."
check_yoyo_directory

echo ""
echo "📊 SCAN RESULTS:"
if [ $ERRORS_FOUND -eq 0 ]; then
    echo "✅ SUCCESS: No secrets or dangerous files found!"
    echo "🚀 Ready for commit"
    exit 0
else
    echo "❌ FAILED: Secrets or dangerous files detected!"
    echo "🚨 DO NOT COMMIT until these issues are resolved"
    exit 1
fi 