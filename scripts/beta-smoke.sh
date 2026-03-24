#!/usr/bin/env bash
# Beta core smoke: health, personality, compose, comparisons, sandbox report, compat health.
# Usage: API_BASE_URL=http://localhost:4000 ./scripts/beta-smoke.sh
#        API_BASE_URL=https://your-engine.onrender.com ./scripts/beta-smoke.sh
# Optional: EXPECT_VIZ=1 to assert compose returns .viz (use when server has VNEXT_VIZ=1).

set -e
BASE="${API_BASE_URL:-http://localhost:4000}"
BASE="${BASE%/}"
PASS=0
FAIL=0
expect_viz="${EXPECT_VIZ:-0}"

result() {
  if [ "$1" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "  PASS: $2"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $2"
  fi
}

echo "Beta smoke: $BASE"
echo "---"

# 1. Health
code=$(curl -s -o /tmp/health.json -w "%{http_code}" "$BASE/health")
if [ "$code" = "200" ]; then
  status=$(jq -r '.status // empty' /tmp/health.json)
  if [ "$status" = "ok" ]; then result PASS "GET /health 200 status=ok"; else result FAIL "GET /health 200 but status=$status"; fi
else
  result FAIL "GET /health $code"
fi

# 2. Create chart A for personality + comparisons
chartA=$(curl -s -X POST "$BASE/api/charts" -H "Content-Type: application/json" \
  -d '{"label":"Smoke A","date":"2025-01-15","time":"12:00","lat":40.7128,"lon":-74.006}')
idA=$(echo "$chartA" | jq -r '.id // empty')
if [ -z "$idA" ]; then
  result FAIL "POST /api/charts (A) no .id"
else
  result PASS "POST /api/charts (A) id=$idA"
fi

# 3. Personality by chartId
if [ -n "$idA" ]; then
  code=$(curl -s -o /tmp/personality.json -w "%{http_code}" "$BASE/api/personality/$idA")
  if [ "$code" = "200" ]; then
    traits=$(jq -r '.personality.traits | keys | length' /tmp/personality.json 2>/dev/null || echo "0")
    pp=$(jq -r '.personality.temperament // .personality.subsystems // empty' /tmp/personality.json 2>/dev/null || echo "")
    if [ "${traits:-0}" -gt 0 ]; then result PASS "GET /api/personality/:chartId 200 traits present"
    elif [ -n "$pp" ]; then result PASS "GET /api/personality/:chartId 200 pp.v1 personality present"
    else result FAIL "GET /api/personality/:chartId 200 but no traits/temperament"; fi
  else
    result FAIL "GET /api/personality/:chartId $code"
  fi
fi

# 4. Compose (sandbox)
compose_body='{"mode":"sandbox","chartData":{"date":"1990-01-01","time":"12:00","lat":40.7128,"lon":-74.006},"controls":{}}'
code=$(curl -s -o /tmp/compose.json -w "%{http_code}" -X POST "$BASE/api/compose" -H "Content-Type: application/json" -d "$compose_body")
if [ "$code" = "200" ]; then
  planHash=$(jq -r '.hashes.plan_sha256 // empty' /tmp/compose.json)
  secLen=$(jq -r '.explanation.sections | length' /tmp/compose.json 2>/dev/null || echo "0")
  vizNull=$(jq -r '.viz == null' /tmp/compose.json 2>/dev/null || echo "true")
  if [ -n "$planHash" ]; then result PASS "POST /api/compose 200 plan_sha256 present"; else result FAIL "POST /api/compose 200 no plan_sha256"; fi
  if [ "${secLen:-0}" -gt 0 ]; then result PASS "POST /api/compose explanation.sections length > 0"; else result FAIL "POST /api/compose explanation.sections empty"; fi
  if [ "$expect_viz" = "1" ]; then
    if [ "$vizNull" = "false" ]; then result PASS "POST /api/compose viz present (EXPECT_VIZ=1)"; else result FAIL "POST /api/compose viz null (expected viz when EXPECT_VIZ=1)"; fi
  else
    if [ "$vizNull" = "true" ]; then result PASS "POST /api/compose viz null (default)"; else result PASS "POST /api/compose viz present (server has VNEXT_VIZ=1)"; fi
  fi
else
  result FAIL "POST /api/compose $code"
fi

# 5. Chart B and comparisons
chartB=$(curl -s -X POST "$BASE/api/charts" -H "Content-Type: application/json" \
  -d '{"label":"Smoke B","date":"1990-06-01","time":"14:30","lat":34.05,"lon":-118.25}')
idB=$(echo "$chartB" | jq -r '.id // empty')
if [ -z "$idB" ]; then
  result FAIL "POST /api/charts (B) no .id"
else
  result PASS "POST /api/charts (B) id=$idB"
fi
if [ -n "$idA" ] && [ -n "$idB" ]; then
  cmpBody="{\"chartAId\":\"$idA\",\"chartBId\":\"$idB\",\"relationshipMode\":\"friends\"}"
  code=$(curl -s -o /tmp/comparisons.json -w "%{http_code}" -X POST "$BASE/api/comparisons" -H "Content-Type: application/json" -d "$cmpBody")
  if [ "$code" = "200" ]; then
    planHashC=$(jq -r '.planHash // empty' /tmp/comparisons.json)
    if [ -n "$planHashC" ]; then result PASS "POST /api/comparisons 200 planHash present"; else result FAIL "POST /api/comparisons 200 no planHash"; fi
  else
    result FAIL "POST /api/comparisons $code"
  fi
fi

# 6. Sandbox report
sandboxBody='{"birth":{"date":"1990-01-15","time":"12:00","lat":40.7128,"lon":-74.006},"overrides":{"planets":{"sun":{"lonDeg":123.4},"moon":{"lonDeg":210}}}}'
code=$(curl -s -o /tmp/sandbox.json -w "%{http_code}" -X POST "$BASE/api/sandbox/report" -H "Content-Type: application/json" -d "$sandboxBody")
if [ "$code" = "200" ]; then
  featLen=$(jq -r '.features | length' /tmp/sandbox.json 2>/dev/null || echo "0")
  if [ "${featLen:-0}" = "64" ]; then result PASS "POST /api/sandbox/report 200 features length 64"; else result FAIL "POST /api/sandbox/report 200 features length=$featLen"; fi
else
  result FAIL "POST /api/sandbox/report $code"
fi

# 7. Compat health
code=$(curl -s -o /tmp/compat-health.json -w "%{http_code}" "$BASE/api/compat/health")
if [ "$code" = "200" ]; then
  synastry=$(jq -r '.synastry // empty' /tmp/compat-health.json)
  if [ -n "$synastry" ]; then result PASS "GET /api/compat/health 200 synastry=$synastry"; else result PASS "GET /api/compat/health 200"; fi
else
  result FAIL "GET /api/compat/health $code"
fi

echo "---"
echo "Summary: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
