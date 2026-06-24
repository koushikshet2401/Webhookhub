# backend/scripts/smoke-test.sh

#!/bin/bash
# Smoke test for WebhookHub backend - run this against your REAL running
# server (real MySQL via Prisma, real Redis) to confirm the flows that were
# verified against an in-memory mock during development behave the same way
# against your actual database.
#
# Usage:
#   chmod +x scripts/smoke-test.sh
#   ./scripts/smoke-test.sh [baseUrl]
#
# Requires: the backend running (npm run dev), a reachable receiver for the
# delivery test (this script starts a tiny one on port 7999 automatically).

BASE_URL="${1:-http://localhost:6000}"
PASS=0
FAIL=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS - $label"
    PASS=$((PASS+1))
  else
    echo "FAIL - $label (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Smoke testing $BASE_URL ==="
echo ""

# 0. Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
check "health check" "200" "$STATUS"

# Note: this script does NOT spin up a local receiver - your own SSRF
# protection correctly blocks localhost/loopback/private targets, which
# means a local test receiver can never be a valid endpoint target. That's
# the protection working as intended, not a bug. Instead this uses
# https://httpbin.org/post, a real public endpoint that echoes back
# whatever is POSTed to it - a legitimate target your server can actually
# reach over the internet.

EMAIL="smoketest_$(date +%s)@example.com"

# 1. Register (first user in a fresh DB becomes ADMIN - if your DB already
# has users, this user will be DEVELOPER instead, which is also correct)
REG=$(curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"password123\"}")
TOKEN=$(echo "$REG" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
check "register returns a token" "1" "$([ -n "$TOKEN" ] && echo 1 || echo 0)"

# 2. Reject bad input
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" \
  -d '{"name":"X","email":"not-an-email","password":"123"}')
check "validation rejects bad register input" "400" "$STATUS"

# 3. Create a project
PROJ=$(curl -s -X POST "$BASE_URL/api/projects" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"name":"Smoke Test Project"}')
PROJECT_ID=$(echo "$PROJ" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
check "project created" "1" "$([ -n "$PROJECT_ID" ] && echo 1 || echo 0)"

# 4. SSRF protection actually blocks a private IP
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/projects/$PROJECT_ID/endpoints" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}')
check "SSRF protection blocks cloud metadata IP" "400" "$STATUS"

# 5. A real endpoint gets created
EP=$(curl -s -X POST "$BASE_URL/api/projects/$PROJECT_ID/endpoints" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"url":"https://httpbin.org/post"}')
check "endpoint created against your real DB" "1" "$(echo "$EP" | grep -q '"secret"' && echo 1 || echo 0)"

# 6. The secret never shows up again on GET
EP_ID=$(echo "$EP" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
GET_EP=$(curl -s "$BASE_URL/api/endpoints/$EP_ID" -H "Authorization: Bearer $TOKEN")
check "endpoint secret never re-exposed" "0" "$(echo "$GET_EP" | grep -q '"secret"' && echo 1 || echo 0)"

# 7. Create an API key, ingest a real event
KEY=$(curl -s -X POST "$BASE_URL/api/projects/$PROJECT_ID/api-keys" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"label":"smoke"}')
API_KEY=$(echo "$KEY" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

INGEST=$(curl -s -X POST "$BASE_URL/api/events" -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" -d '{"eventType":"smoke.test","payload":{"ok":true}}')
DELIVERY_ID=$(echo "$INGEST" | grep -o '"deliveryId":[0-9]*' | head -1 | grep -o '[0-9]*$')
check "event ingested and fanned out" "1" "$([ -n "$DELIVERY_ID" ] && echo 1 || echo 0)"

# 8. Wait for the real worker (real Redis, real MySQL writes) to process it
sleep 4 # real network round-trip to a public endpoint, not a local receiver
DELIVERY=$(curl -s "$BASE_URL/api/deliveries/$DELIVERY_ID" -H "Authorization: Bearer $TOKEN")
STATUS_VAL=$(echo "$DELIVERY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
check "delivery actually succeeded against your real DB" "SUCCESS" "$STATUS_VAL"

# 9. Pagination envelope is present
PAGED=$(curl -s "$BASE_URL/api/projects/$PROJECT_ID/deliveries" -H "Authorization: Bearer $TOKEN")
check "delivery list returns pagination metadata" "1" "$(echo "$PAGED" | grep -q '"pagination"' && echo 1 || echo 0)"

# 10. Logout actually revokes the token
curl -s -X POST "$BASE_URL/api/auth/logout" -H "Authorization: Bearer $TOKEN" > /dev/null
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/logout" -H "Authorization: Bearer $TOKEN")
check "logout revokes the token (second use rejected)" "401" "$STATUS"


echo ""
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1