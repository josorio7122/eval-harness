#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"

# Check prerequisites
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "⚠️  OPENROUTER_API_KEY not set — skipping e2e test"
  echo "   Set it to run the full experiment lifecycle test"
  exit 0
fi

echo "🧪 E2E Test: Full Experiment Lifecycle"
echo "   API: $API_URL"
echo ""

PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

# --- Step 1: Create Dataset ---
echo "📦 Creating dataset..."
RES=$(curl -s -w '\n%{http_code}' -X POST "$API_URL/datasets" \
  -H 'Content-Type: application/json' \
  -d '{"name": "e2e-test-dataset"}')
BODY=$(echo "$RES" | sed '$d')
STATUS=$(echo "$RES" | tail -1)
check "Create dataset" "201" "$STATUS"
DATASET_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# --- Step 2: Add 3 items ---
echo "📝 Adding items..."
for i in 1 2 3; do
  RES=$(curl -s -w '\n%{http_code}' -X POST "$API_URL/datasets/$DATASET_ID/items" \
    -H 'Content-Type: application/json' \
    -d "{\"values\": {\"input\": \"What is ${i}+${i}?\", \"expected_output\": \"$((i*2))\"}}")
  STATUS=$(echo "$RES" | tail -1)
  check "Create item $i" "201" "$STATUS"
done

# --- Step 3: Create 2 graders ---
echo "📋 Creating graders..."
RES=$(curl -s -w '\n%{http_code}' -X POST "$API_URL/graders" \
  -H 'Content-Type: application/json' \
  -d '{"name": "e2e-accuracy", "description": "Checks math accuracy", "rubric": "The user message contains an input question and expected output. Evaluate whether the expected output is the correct answer to the input question. If yes, verdict is pass. If no, verdict is fail."}')
BODY=$(echo "$RES" | sed '$d')
STATUS=$(echo "$RES" | tail -1)
check "Create grader 1" "201" "$STATUS"
GRADER1_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

RES=$(curl -s -w '\n%{http_code}' -X POST "$API_URL/graders" \
  -H 'Content-Type: application/json' \
  -d '{"name": "e2e-clarity", "description": "Checks answer clarity", "rubric": "The user message contains an input question and expected output. Evaluate whether the expected output is clear and unambiguous as an answer. A simple number is clear. Verdict should be pass for clear answers."}')
BODY=$(echo "$RES" | sed '$d')
STATUS=$(echo "$RES" | tail -1)
check "Create grader 2" "201" "$STATUS"
GRADER2_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# --- Step 4: Create experiment ---
echo "🔬 Creating experiment..."
RES=$(curl -s -w '\n%{http_code}' -X POST "$API_URL/experiments" \
  -H 'Content-Type: application/json' \
  -d "{\"name\": \"e2e-run\", \"datasetId\": \"$DATASET_ID\", \"graderIds\": [\"$GRADER1_ID\", \"$GRADER2_ID\"]}")
BODY=$(echo "$RES" | sed '$d')
STATUS=$(echo "$RES" | tail -1)
check "Create experiment" "201" "$STATUS"
EXP_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# --- Step 5: Run experiment ---
echo "🚀 Running experiment..."
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/experiments/$EXP_ID/run")
check "Run experiment (202 Accepted)" "202" "$STATUS"

# --- Step 6: Wait for completion via SSE ---
echo "⏳ Waiting for experiment to complete (timeout: 120s)..."
TMPFILE=$(mktemp)
curl -s -N "$API_URL/experiments/$EXP_ID/events" > "$TMPFILE" 2>/dev/null &
CURL_PID=$!

TIMEOUT=120
ELAPSED=0
COMPLETED=false
while [ $ELAPSED -lt $TIMEOUT ]; do
  if grep -q '"completed"\|"error"' "$TMPFILE" 2>/dev/null; then
    COMPLETED=true
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done

kill $CURL_PID 2>/dev/null || true
rm -f "$TMPFILE"

if [ "$COMPLETED" = true ]; then
  echo "  ✅ Experiment finished within ${ELAPSED}s"
  PASS=$((PASS+1))
else
  echo "  ❌ Experiment timed out after ${TIMEOUT}s"
  FAIL=$((FAIL+1))
fi

# --- Step 7: Verify experiment status and results ---
echo "📊 Verifying results..."
RES=$(curl -s "$API_URL/experiments/$EXP_ID")
EXP_STATUS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
check "Experiment status = complete" "complete" "$EXP_STATUS"

RESULT_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['results']))")
check "Result count = 6 (3 items × 2 graders)" "6" "$RESULT_COUNT"

# --- Step 8: Compute aggregate pass rate ---
PASS_RATE=$(echo "$RES" | python3 -c "
import sys,json
results = json.load(sys.stdin)['data']['results']
passes = sum(1 for r in results if r['verdict'] == 'pass')
pct = round(passes / len(results) * 100)
print(pct)
")
echo "  📈 Pass rate: ${PASS_RATE}%"
if [ "$PASS_RATE" -ge 0 ] && [ "$PASS_RATE" -le 100 ]; then
  echo "  ✅ Pass rate is valid (0-100%)"
  PASS=$((PASS+1))
else
  echo "  ❌ Pass rate out of range: $PASS_RATE"
  FAIL=$((FAIL+1))
fi

# --- Step 9: Export CSV ---
echo "📄 Exporting CSV..."
RES=$(curl -s -w '\n%{http_code}' "$API_URL/experiments/$EXP_ID/csv/export")
CSV_BODY=$(echo "$RES" | sed '$d')
STATUS=$(echo "$RES" | tail -1)
check "CSV export status" "200" "$STATUS"

CSV_HEADER=$(echo "$CSV_BODY" | head -1)
echo "  CSV header: $CSV_HEADER"

# Check header contains attribute columns and grader columns
if echo "$CSV_HEADER" | grep -q "input" && echo "$CSV_HEADER" | grep -q "expected_output" && echo "$CSV_HEADER" | grep -q "_verdict" && echo "$CSV_HEADER" | grep -q "_reason"; then
  echo "  ✅ CSV headers contain expected columns"
  PASS=$((PASS+1))
else
  echo "  ❌ CSV headers missing expected columns"
  FAIL=$((FAIL+1))
fi

CSV_ROW_COUNT=$(echo "$CSV_BODY" | tail -n +2 | wc -l | tr -d ' ')
check "CSV row count = 3" "3" "$CSV_ROW_COUNT"

# --- Step 10: Cleanup ---
echo "🧹 Cleaning up..."
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/experiments/$EXP_ID")
check "Delete experiment" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/graders/$GRADER1_ID")
check "Delete grader 1" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/graders/$GRADER2_ID")
check "Delete grader 2" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/datasets/$DATASET_ID")
check "Delete dataset" "200" "$STATUS"

# --- Summary ---
echo ""
echo "================================"
TOTAL=$((PASS+FAIL))
echo "E2E TOTAL: $TOTAL | PASS: $PASS | FAIL: $FAIL"
echo "================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
