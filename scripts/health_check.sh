#!/bin/bash
# Health check script for Whisper service monitoring

set -e

WHISPER_URL="${WHISPER_URL:-http://localhost:8000}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_THRESHOLD=5  # seconds
MAX_FAILURES=3
FAILURE_COUNT_FILE="/tmp/whisper_health_failures"

# Initialize failure counter
if [ ! -f "$FAILURE_COUNT_FILE" ]; then
    echo "0" > "$FAILURE_COUNT_FILE"
fi

# Check health endpoint
start_time=$(date +%s)
response=$(curl -sf -w "\n%{http_code}" "${WHISPER_URL}/health" 2>&1) || {
    http_code=0
}

if [ "$http_code" != "0" ]; then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
fi

end_time=$(date +%s)
response_time=$((end_time - start_time))

# Check if healthy
if [ "$http_code" = "200" ]; then
    # Success - reset failure counter
    echo "0" > "$FAILURE_COUNT_FILE"
    
    # Warn if slow
    if [ "$response_time" -gt "$ALERT_THRESHOLD" ]; then
        echo "⚠️  Whisper service slow: ${response_time}s (threshold: ${ALERT_THRESHOLD}s)"
        
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-Type: application/json' \
                -d "{\"text\":\"⚠️ Whisper service slow: ${response_time}s response time\"}"
        fi
    fi
    
    exit 0
else
    # Failure - increment counter
    current_failures=$(cat "$FAILURE_COUNT_FILE")
    new_failures=$((current_failures + 1))
    echo "$new_failures" > "$FAILURE_COUNT_FILE"
    
    echo "❌ Whisper service unhealthy (attempt $new_failures/$MAX_FAILURES): HTTP $http_code"
    
    # Alert after threshold failures
    if [ "$new_failures" -ge "$MAX_FAILURES" ]; then
        echo "🚨 ALERT: Whisper service down after $MAX_FAILURES consecutive failures"
        
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-Type: application/json' \
                -d "{\"text\":\"🚨 ALERT: Whisper service DOWN\\nHTTP Status: $http_code\\nConsecutive Failures: $new_failures\"}"
        fi
    fi
    
    exit 1
fi
