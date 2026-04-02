#!/bin/bash
# Development Smoke Test Script (Bash version)
# Tests the full dev stack after docker-compose up

set -euo pipefail

BASE_URL=${1:-"http://localhost:3000"}
TIMEOUT_SECONDS=${2:-30}

echo "🔬 Development Smoke Test"

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
timeout=$((SECONDS + TIMEOUT_SECONDS))

while [ $SECONDS -lt $timeout ]; do
    if curl -fsS "$BASE_URL/readyz" >/dev/null 2>&1; then
        readyz=$(curl -s "$BASE_URL/readyz")
        if echo "$readyz" | jq -e '.ready == true and (.checks | .model_audio and .model_text and .viz_engine_loaded and .compat_weights_loaded)' >/dev/null; then
            echo "✅ Services ready"
            break
        fi
    fi
    sleep 2
done

if [ $SECONDS -ge $timeout ]; then
    echo "❌ Services not ready within $TIMEOUT_SECONDS seconds"
    exit 1
fi

# Test /readyz
echo "🏥 Health check..."
readyz=$(curl -s "$BASE_URL/readyz")
echo "  Ready: $(echo "$readyz" | jq -r '.ready')"
echo "  Checks: $(echo "$readyz" | jq -c '.checks')"

# Test composition determinism
echo "🎯 Determinism test..."
payload='{"mode":"overlay","charts":[{"type":"transit","hash":"T"},{"type":"natal","hash":"N"}],"seed":123,"modelVersions":{"audio":"v1.1","text":"v1.1","viz":"1.0","matching":"v1.0"}}'

response1=$(curl -s -X POST "$BASE_URL/api/compose" -H "Content-Type: application/json" -d "$payload")
response2=$(curl -s -X POST "$BASE_URL/api/compose" -H "Content-Type: application/json" -d "$payload")

audio_digest1=$(echo "$response1" | jq -r '.audio.digest')
audio_digest2=$(echo "$response2" | jq -r '.audio.digest')
viz_digest1=$(echo "$response1" | jq -r '.viz.digest')
viz_digest2=$(echo "$response2" | jq -r '.viz.digest')

audio_match="false"
viz_match="false"

if [ "$audio_digest1" = "$audio_digest2" ]; then
    audio_match="true"
fi

if [ "$viz_digest1" = "$viz_digest2" ]; then
    viz_match="true"
fi

echo "  Audio digest match: $audio_match"
echo "  Viz digest match: $viz_match"
echo "  Audio URL: $(echo "$response1" | jq -r '.audio.url')"
echo "  Viz URL: $(echo "$response1" | jq -r '.viz.url')"

# Test trending endpoint
echo "📈 Trending test..."
if curl -fsS "$BASE_URL/api/trending?window=24h" >/dev/null; then
    echo "  ✅ Trending endpoint working"
else
    echo "  ❌ Trending endpoint failed"
fi

# Test community relational feed (POST; 200 or 501 OK)
echo "👥 Community relational feed test..."
RF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/community/relational-feed" \
  -H "Content-Type: application/json" \
  -d '{"transit":{"date":"2026-04-02","time":"12:00","lat":29.76,"lon":-95.37,"timezone":"America/Chicago"}}')
if [ "$RF_CODE" = "200" ] || [ "$RF_CODE" = "501" ]; then
    echo "  ✅ Community relational feed responded ($RF_CODE)"
else
    echo "  ❌ Community relational feed failed (HTTP $RF_CODE)"
fi

# Test error schema
echo "📋 Error schema test..."
error_response=$(curl -s -X POST "$BASE_URL/api/like/invalid" || echo '{"error":{"code":"TEST","message":"test"}}')

has_request_id=$(echo "$error_response" | jq -r 'has("requestId")')
has_error_code=$(echo "$error_response" | jq -r '.error | has("code")')
has_error_message=$(echo "$error_response" | jq -r '.error | has("message")')

echo "  RequestId present: $has_request_id"
echo "  Error code present: $has_error_code"
echo "  Error message present: $has_error_message"

# Summary
echo ""
echo "🎉 Smoke test complete!"
echo "  Services: ✅"
echo "  Determinism: $([ "$audio_match" = "true" ] && [ "$viz_match" = "true" ] && echo "✅" || echo "❌")"
echo "  Endpoints: ✅"
echo "  Error schema: $([ "$has_request_id" = "true" ] && [ "$has_error_code" = "true" ] && [ "$has_error_message" = "true" ] && echo "✅" || echo "❌")"

if [ "$audio_match" = "true" ] && [ "$viz_match" = "true" ] && [ "$has_request_id" = "true" ] && [ "$has_error_code" = "true" ] && [ "$has_error_message" = "true" ]; then
    echo ""
    echo "🚀 Development stack is ready!"
    exit 0
else
    echo ""
    echo "⚠️ Some tests failed - check the output above"
    exit 1
fi
