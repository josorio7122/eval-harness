#!/usr/bin/env bash
# e2e-test.sh — Full experiment lifecycle E2E test with real LLM evaluation.
# Requires OPENROUTER_API_KEY. Tests: create dataset → add items → create graders →
# create experiment → run → poll → verify SSE → verify results → export CSV → cleanup.

set -euo pipefail

BASE="${API_URL:-http://localhost:3001}"
PASS=0
FAIL=0
STEP=0

# ─── Colors ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────────────────
pass() {
  PASS=$((PASS + 1))
  STEP=$((STEP + 1))
  echo -e "  ${GREEN}✅ ${STEP}. PASS${RESET} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  STEP=$((STEP + 1))
  echo -e "  ${RED}❌ ${STEP}. FAIL${RESET} — $1"
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════${RESET}"
}

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (status $actual)"
  else
    fail "$label (expected $expected, got $actual)"
  fi
}

body_of() { echo "$1" | awk 'NR>1{print prev} {prev=$0}'; }
status_of() { echo "$1" | tail -n 1; }

curl_json() {
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" "${BASE}${path}"
  else
    curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}"
  fi
}

curl_get() {
  curl -s -w "\n%{http_code}" "${BASE}${1}"
}

# ─── Prerequisite check ─────────────────────────────────────────────────
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo -e "${YELLOW}⚠️  OPENROUTER_API_KEY not set — skipping lifecycle test${RESET}"
  echo "   Set it to run the full experiment lifecycle test."
  exit 0
fi

echo ""
echo -e "${BOLD}E2E Lifecycle Test — Full Experiment with Real LLM${RESET}"
echo -e "Target: ${BASE}"
echo ""

if ! curl -s --max-time 3 "${BASE}/datasets" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Server not reachable at ${BASE}${RESET}"
  echo "Start the server first: pnpm dev"
  exit 1
fi
echo -e "${GREEN}Server is reachable ✓${RESET}"

# ─── Cleanup trap ────────────────────────────────────────────────────────
SSE_PID=""
SSE_FILE=""
DATASET_ID=""
GRADER1_ID=""
GRADER2_ID=""
EXP_ID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}Cleaning up test data...${RESET}"
  [[ -n "$SSE_PID" ]] && kill "$SSE_PID" 2>/dev/null || true
  [[ -n "$SSE_FILE" ]] && rm -f "$SSE_FILE"
  [[ -n "$EXP_ID" ]] && curl -s -X DELETE "${BASE}/experiments/${EXP_ID}" > /dev/null 2>&1 || true
  [[ -n "$GRADER1_ID" ]] && curl -s -X DELETE "${BASE}/graders/${GRADER1_ID}" > /dev/null 2>&1 || true
  [[ -n "$GRADER2_ID" ]] && curl -s -X DELETE "${BASE}/graders/${GRADER2_ID}" > /dev/null 2>&1 || true
  [[ -n "$DATASET_ID" ]] && curl -s -X DELETE "${BASE}/datasets/${DATASET_ID}" > /dev/null 2>&1 || true
  echo -e "${GREEN}Cleanup complete ✓${RESET}"
}
trap cleanup EXIT

# ─── DATASET ─────────────────────────────────────────────────────────────
section "DATASET SETUP"

R=$(curl_json POST /datasets "{\"name\":\"e2e-lifecycle-$$\"}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create dataset" 201 "$S"
DATASET_ID=$(echo "$B" | jq -r '.id')
echo "    → DATASET_ID: $DATASET_ID"

for i in 1 2 3; do
  R=$(curl_json POST "/datasets/${DATASET_ID}/items" \
    "{\"values\":{\"input\":\"What is ${i}+${i}?\",\"expected_output\":\"$((i*2))\"}}")
  S=$(status_of "$R")
  assert_status "Create item $i" 201 "$S"
done

# ─── GRADERS ─────────────────────────────────────────────────────────────
section "GRADERS"

R=$(curl_json POST /graders \
  "{\"name\":\"e2e-accuracy-$$\",\"description\":\"Checks math accuracy\",\"rubric\":\"The user message contains an input question and expected output. Evaluate whether the expected output is the correct answer to the input question. If yes, verdict is pass. If no, verdict is fail.\"}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create accuracy grader" 201 "$S"
GRADER1_ID=$(echo "$B" | jq -r '.id')
echo "    → GRADER1_ID: $GRADER1_ID"

R=$(curl_json POST /graders \
  "{\"name\":\"e2e-clarity-$$\",\"description\":\"Checks answer clarity\",\"rubric\":\"The user message contains an input question and expected output. Evaluate whether the expected output is clear and unambiguous as an answer. A simple number is clear. Verdict should be pass for clear answers.\"}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create clarity grader" 201 "$S"
GRADER2_ID=$(echo "$B" | jq -r '.id')
echo "    → GRADER2_ID: $GRADER2_ID"

# ─── EXPERIMENT ──────────────────────────────────────────────────────────
section "EXPERIMENT"

R=$(curl_json POST /experiments \
  "{\"name\":\"e2e-run-$$\",\"datasetId\":\"${DATASET_ID}\",\"graderIds\":[\"${GRADER1_ID}\",\"${GRADER2_ID}\"]}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create experiment" 201 "$S"
EXP_ID=$(echo "$B" | jq -r '.id')
echo "    → EXP_ID: $EXP_ID"

# ─── SSE LISTENER ────────────────────────────────────────────────────────
section "SSE + RUN"

SSE_FILE=$(mktemp)
curl -s -N "${BASE}/experiments/${EXP_ID}/events" > "$SSE_FILE" 2>/dev/null &
SSE_PID=$!
sleep 1

R=$(curl_json POST "/experiments/${EXP_ID}/run")
S=$(status_of "$R")
assert_status "Run experiment" 202 "$S"

# ─── POLL ────────────────────────────────────────────────────────────────
echo "    → Polling experiment status (timeout: 120s)..."
POLL_TIMEOUT=120
POLL_ELAPSED=0
EXP_STATUS="unknown"
while [[ $POLL_ELAPSED -lt $POLL_TIMEOUT ]]; do
  sleep 2
  POLL_ELAPSED=$((POLL_ELAPSED + 2))
  R=$(curl_get "/experiments/${EXP_ID}")
  B=$(body_of "$R")
  EXP_STATUS=$(echo "$B" | jq -r '.status')
  if [[ "$EXP_STATUS" == "complete" || "$EXP_STATUS" == "failed" ]]; then
    break
  fi
done

if [[ "$EXP_STATUS" == "complete" || "$EXP_STATUS" == "failed" ]]; then
  pass "Experiment finished in ${POLL_ELAPSED}s (status: $EXP_STATUS)"
else
  fail "Experiment timed out after ${POLL_TIMEOUT}s (status: $EXP_STATUS)"
fi

# ─── SSE VERIFICATION ───────────────────────────────────────────────────
section "SSE VERIFICATION"

sleep 2
kill "$SSE_PID" 2>/dev/null || true
SSE_PID=""

PROGRESS_COUNT=$(grep -c 'event: progress' "$SSE_FILE" 2>/dev/null || echo "0")
echo "    → Progress events received: $PROGRESS_COUNT"

grep 'data:.*cellsCompleted' "$SSE_FILE" 2>/dev/null | while read -r line; do
  CELLS=$(echo "$line" | sed 's/^data: //' | jq -r '"\(.cellsCompleted)/\(.totalCells)"' 2>/dev/null)
  echo "    → 📊 Progress: $CELLS"
done

[[ "$PROGRESS_COUNT" == "6" ]] \
  && pass "SSE progress events = 6 (3 items × 2 graders)" \
  || fail "SSE progress events expected 6, got $PROGRESS_COUNT"

grep -q 'event: connected' "$SSE_FILE" 2>/dev/null \
  && pass "SSE connected event received" \
  || fail "SSE connected event missing"

# ─── RESULTS ─────────────────────────────────────────────────────────────
section "RESULTS"

R=$(curl_get "/experiments/${EXP_ID}")
B=$(body_of "$R")
FINAL_STATUS=$(echo "$B" | jq -r '.status')
assert_status "Experiment status = complete" "complete" "$FINAL_STATUS"

RESULT_COUNT=$(echo "$B" | jq '.results | length')
[[ "$RESULT_COUNT" == "6" ]] \
  && pass "Result count = 6 (3 items × 2 graders)" \
  || fail "Result count expected 6, got $RESULT_COUNT"

PASS_COUNT=$(echo "$B" | jq '[.results[] | select(.verdict == "pass")] | length')
PASS_RATE=$((PASS_COUNT * 100 / RESULT_COUNT))
echo "    → Pass rate: ${PASS_RATE}% ($PASS_COUNT/$RESULT_COUNT)"
[[ "$PASS_RATE" -ge 0 && "$PASS_RATE" -le 100 ]] \
  && pass "Pass rate is valid (${PASS_RATE}%)" \
  || fail "Pass rate out of range: $PASS_RATE"

# ─── CSV EXPORT ──────────────────────────────────────────────────────────
section "CSV EXPORT"

R=$(curl_get "/experiments/${EXP_ID}/csv/export")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "CSV export" 200 "$S"

CSV_HEADER=$(echo "$B" | head -1)
echo "    → Header: $CSV_HEADER"

if echo "$CSV_HEADER" | grep -q "input" && \
   echo "$CSV_HEADER" | grep -q "expected_output" && \
   echo "$CSV_HEADER" | grep -q "_verdict" && \
   echo "$CSV_HEADER" | grep -q "_reason"; then
  pass "CSV headers contain expected columns"
else
  fail "CSV headers missing expected columns"
fi

CSV_ROW_COUNT=$(echo "$B" | tail -n +2 | wc -l | tr -d ' ')
[[ "$CSV_ROW_COUNT" == "3" ]] \
  && pass "CSV row count = 3" \
  || fail "CSV row count expected 3, got $CSV_ROW_COUNT"

# ─── SUMMARY ─────────────────────────────────────────────────────────────
# (cleanup happens via trap)

section "SUMMARY"

TOTAL=$((PASS + FAIL))
echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}🎉 ${PASS}/${TOTAL} tests passed${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}💥 ${PASS}/${TOTAL} tests passed — ${FAIL} failed${RESET}"
  exit 1
fi
