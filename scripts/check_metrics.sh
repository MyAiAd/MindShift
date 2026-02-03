#!/bin/bash
# Check Whisper service metrics and alert if anomalies detected

set -e

WHISPER_URL="${WHISPER_URL:-http://localhost:8000}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
MIN_CACHE_HIT_RATE=10  # percent

# Get stats
stats=$(curl -sf "${WHISPER_URL}/stats") || {
    echo "❌ Failed to fetch stats from Whisper service"
    exit 1
}

# Parse cache hit rate
cache_hit_rate=$(echo "$stats" | grep -o '"hit_rate_percent":[0-9.]*' | cut -d':' -f2 | cut -d'.' -f1)

echo "📊 Whisper Service Stats:"
echo "  Cache Hit Rate: ${cache_hit_rate}%"

# Check cache hit rate
if [ "$cache_hit_rate" -lt "$MIN_CACHE_HIT_RATE" ]; then
    echo "⚠️  Low cache hit rate: ${cache_hit_rate}% (threshold: ${MIN_CACHE_HIT_RATE}%)"
    echo "  This suggests caching may not be working properly"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"⚠️ Whisper cache hit rate low: ${cache_hit_rate}%\"}"
    fi
fi

# Log full stats
echo "Full stats: $stats"
