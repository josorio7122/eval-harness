#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# e2e-smoke.sh — Full API smoke test
#
# Runs ~70 assertions against a live API server at http://localhost:3001.
# Tests every REST endpoint across all 3 domains (datasets, graders, experiments)
# plus CSV operations, dataset revisions, SSE streaming, and cascade deletion.
#
# Does NOT require OPENROUTER_API_KEY — experiment tests accept any terminal
# status (complete, failed, running) since the LLM may not be configured.
#
# Prerequisites:
#   - API server running:  pnpm dev
#   - PostgreSQL running:  docker compose up -d
#   - jq installed
#
# Usage:
#   ./scripts/e2e-smoke.sh
#
# Safe to re-run: cleans up leftover test data at startup + EXIT trap.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE="http://localhost:3001"
PASS=0
FAIL=0
STEP=0

# ─── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────────────────
# pass/fail: increment counters and print colored step output
# assert_status: compare HTTP status codes
# body_of/status_of: split curl response (body is all lines except last, status is last line)
# curl_json/curl_get/curl_csv: curl wrappers that append HTTP status as last line
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

# assert_status <label> <expected> <actual>
assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (status $actual)"
  else
    fail "$label (expected $expected, got $actual)"
  fi
}

# macOS-compatible body_of: all lines except last
body_of() {
  echo "$1" | awk 'NR>1{print prev} {prev=$0}'
}
status_of() { echo "$1" | tail -n 1; }

# curl helpers — each returns "BODY\nSTATUS_CODE"
curl_json() {
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "${BASE}${path}"
  else
    curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}"
  fi
}

curl_get() {
  curl -s -w "\n%{http_code}" "${BASE}${1}"
}

curl_csv() {
  local method="$1" path="$2" data="$3"
  printf '%s' "$data" | curl -s -w "\n%{http_code}" -X "$method" \
    -H "Content-Type: text/plain" \
    --data-binary @- \
    "${BASE}${path}"
}

# ─── Preflight ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Mini-Skills API E2E Smoke Test${RESET}"
echo -e "Target: ${BASE}"
echo ""

if ! curl -s --max-time 3 "${BASE}/datasets" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Server not reachable at ${BASE}${RESET}"
  echo "Start the server first: pnpm dev"
  exit 1
fi
echo -e "${GREEN}Server is reachable ✓${RESET}"

# Track all created entity IDs so the EXIT trap can delete them if the script
# fails mid-run. Order matters: delete experiments first (FK deps), then graders, then datasets.
# ─── IDs for cleanup trap ──────────────────────────────────────────────────────
DATASET_ID=""
GRADER_ID=""
EXPERIMENT_ID=""
RERUN_ID=""
CASCADE_DATASET_ID=""
CASCADE_GRADER_ID=""
CASCADE_EXP_ID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}Cleaning up test data...${RESET}"
  [[ -n "$EXPERIMENT_ID" ]] && curl -s -X DELETE "${BASE}/experiments/${EXPERIMENT_ID}" > /dev/null 2>&1 || true
  [[ -n "$RERUN_ID" ]] && curl -s -X DELETE "${BASE}/experiments/${RERUN_ID}" > /dev/null 2>&1 || true
  [[ -n "$CASCADE_EXP_ID" ]] && curl -s -X DELETE "${BASE}/experiments/${CASCADE_EXP_ID}" > /dev/null 2>&1 || true
  [[ -n "$GRADER_ID" ]] && curl -s -X DELETE "${BASE}/graders/${GRADER_ID}" > /dev/null 2>&1 || true
  [[ -n "$CASCADE_GRADER_ID" ]] && curl -s -X DELETE "${BASE}/graders/${CASCADE_GRADER_ID}" > /dev/null 2>&1 || true
  [[ -n "$DATASET_ID" ]] && curl -s -X DELETE "${BASE}/datasets/${DATASET_ID}" > /dev/null 2>&1 || true
  [[ -n "$CASCADE_DATASET_ID" ]] && curl -s -X DELETE "${BASE}/datasets/${CASCADE_DATASET_ID}" > /dev/null 2>&1 || true
  echo -e "${GREEN}Cleanup complete ✓${RESET}"
}
trap cleanup EXIT

# Remove any entities left from a previous failed run (matched by name).
# This ensures a clean slate even if the EXIT trap didn't fire.
# ─── Cleanup leftover test data ────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Cleaning up any leftover test data from previous runs...${RESET}"
for name in "smoke-test-dataset" "renamed-dataset" "cascade-test"; do
  ID=$(curl -s "${BASE}/datasets" | jq -r --arg n "$name" '.[] | select(.name == $n) | .id' 2>/dev/null || true)
  if [[ -n "$ID" && "$ID" != "null" ]]; then
    curl -s -X DELETE "${BASE}/datasets/${ID}" > /dev/null
    echo "  Deleted dataset: $name ($ID)"
  fi
done
for name in "accuracy-check" "updated-grader" "cascade-grader"; do
  ID=$(curl -s "${BASE}/graders" | jq -r --arg n "$name" '.[] | select(.name == $n) | .id' 2>/dev/null || true)
  if [[ -n "$ID" && "$ID" != "null" ]]; then
    curl -s -X DELETE "${BASE}/graders/${ID}" > /dev/null
    echo "  Deleted grader: $name ($ID)"
  fi
done
echo -e "${GREEN}Cleanup complete ✓${RESET}"

# ─── DATASETS ──────────────────────────────────────────────────────────────────
# Tests: POST /datasets (create), POST duplicate (400), POST empty name (400),
#        GET /datasets (list), GET /datasets/:id (get by ID + verify fields),
#        PATCH /datasets/:id (rename), GET renamed (verify)
section "DATASETS"

R=$(curl_json POST /datasets '{"name":"smoke-test-dataset"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create dataset 'smoke-test-dataset'" 201 "$S"
DATASET_ID=$(echo "$B" | jq -r '.id')
echo "    → DATASET_ID: $DATASET_ID"

R=$(curl_json POST /datasets '{"name":"smoke-test-dataset"}')
S=$(status_of "$R")
assert_status "Create duplicate dataset name → 400" 400 "$S"

R=$(curl_json POST /datasets '{"name":""}')
S=$(status_of "$R")
assert_status "Create dataset with empty name → 400" 400 "$S"

R=$(curl_get /datasets)
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "List datasets → 200" 200 "$S"
COUNT=$(echo "$B" | jq --arg id "$DATASET_ID" '[.[] | select(.id == $id)] | length')
[[ "$COUNT" -ge 1 ]] && pass "List datasets contains smoke-test-dataset" || fail "List datasets does not contain smoke-test-dataset"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get dataset by ID → 200" 200 "$S"
NAME=$(echo "$B" | jq -r '.name')
SCHEMA_VER=$(echo "$B" | jq -r '.schemaVersion')
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$NAME" == "smoke-test-dataset" ]] && pass "Dataset name='smoke-test-dataset'" || fail "Dataset name mismatch: $NAME"
[[ "$SCHEMA_VER" == "1" ]] && pass "Dataset schemaVersion=1" || fail "schemaVersion expected 1, got $SCHEMA_VER"
[[ "$ITEMS_LEN" == "0" ]] && pass "Dataset items=[]" || fail "Dataset items expected empty, got $ITEMS_LEN"

R=$(curl_json PATCH "/datasets/${DATASET_ID}" '{"name":"renamed-dataset"}')
S=$(status_of "$R")
assert_status "Rename dataset → 200" 200 "$S"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get renamed dataset → 200" 200 "$S"
NAME=$(echo "$B" | jq -r '.name')
[[ "$NAME" == "renamed-dataset" ]] && pass "Dataset name='renamed-dataset'" || fail "Rename failed: name='$NAME'"

# ─── ATTRIBUTES ────────────────────────────────────────────────────────────────
# Tests: POST /datasets/:id/attributes (add custom attribute, verify schemaVersion increments),
#        POST duplicate attribute (400), DELETE built-in attribute (400 — 'input' is protected),
#        DELETE custom attribute (200, verify schemaVersion increments again)
section "ATTRIBUTES"

R=$(curl_json POST "/datasets/${DATASET_ID}/attributes" '{"name":"context"}')
S=$(status_of "$R")
assert_status "Add attribute 'context' → 201" 201 "$S"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ATTRS=$(echo "$B" | jq -c '.attributes')
SCHEMA_VER=$(echo "$B" | jq '.schemaVersion')
[[ "$ATTRS" == '["input","expected_output","context"]' ]] \
  && pass "attributes=['input','expected_output','context']" \
  || fail "attributes mismatch: $ATTRS"
[[ "$SCHEMA_VER" == "2" ]] && pass "schemaVersion=2 after add attribute" || fail "schemaVersion expected 2, got $SCHEMA_VER"

R=$(curl_json POST "/datasets/${DATASET_ID}/attributes" '{"name":"input"}')
S=$(status_of "$R")
assert_status "Add duplicate attribute 'input' → 400" 400 "$S"

R=$(curl_json DELETE "/datasets/${DATASET_ID}/attributes/input")
S=$(status_of "$R")
assert_status "Remove builtin attribute 'input' → 400" 400 "$S"

R=$(curl_json DELETE "/datasets/${DATASET_ID}/attributes/context")
S=$(status_of "$R")
assert_status "Remove attribute 'context' → 200" 200 "$S"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ATTRS=$(echo "$B" | jq -c '.attributes')
SCHEMA_VER=$(echo "$B" | jq '.schemaVersion')
[[ "$ATTRS" == '["input","expected_output"]' ]] \
  && pass "attributes=['input','expected_output'] after remove" \
  || fail "attributes mismatch after remove: $ATTRS"
[[ "$SCHEMA_VER" == "3" ]] && pass "schemaVersion=3 after remove attribute" || fail "schemaVersion expected 3, got $SCHEMA_VER"

# ─── ITEMS ─────────────────────────────────────────────────────────────────────
# Tests: POST /datasets/:id/items (create item, verify itemId returned),
#        GET dataset (verify item count), PATCH item (update values),
#        GET dataset (verify updated values), POST second item
section "ITEMS"

R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 2+2?","expected_output":"4"}}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create item → 201" 201 "$S"
ITEM_ID=$(echo "$B" | jq -r '.itemId')
echo "    → ITEM_ID: $ITEM_ID"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$ITEMS_LEN" == "1" ]] && pass "Dataset has 1 item" || fail "Dataset item count expected 1, got $ITEMS_LEN"

R=$(curl_json PATCH "/datasets/${DATASET_ID}/items/${ITEM_ID}" '{"values":{"input":"What is 3+3?","expected_output":"6"}}')
S=$(status_of "$R")
assert_status "Update item → 200" 200 "$S"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
INPUT_VAL=$(echo "$B" | jq -r '.items[0].values.input')
OUTPUT_VAL=$(echo "$B" | jq -r '.items[0].values.expected_output')
[[ "$INPUT_VAL" == "What is 3+3?" ]] && pass "Item input updated to 'What is 3+3?'" || fail "Item input mismatch: $INPUT_VAL"
[[ "$OUTPUT_VAL" == "6" ]] && pass "Item expected_output updated to '6'" || fail "Item output mismatch: $OUTPUT_VAL"

R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 4+4?","expected_output":"8"}}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create second item → 201" 201 "$S"
ITEM2_ID=$(echo "$B" | jq -r '.itemId')

# ─── CSV ───────────────────────────────────────────────────────────────────────
# Tests: GET /csv/template (200, Content-Type: text/csv),
#        POST /csv/preview (parse CSV, verify validRowCount),
#        POST /csv/import (import rows into dataset),
#        GET dataset (verify item count increased),
#        GET /csv/export (200, Content-Type: text/csv)
section "CSV"

HTTP_STATUS=$(curl -s -o /tmp/smoke_template.csv -w "%{http_code}" "${BASE}/datasets/${DATASET_ID}/csv/template")
assert_status "Get CSV template → 200" 200 "$HTTP_STATUS"
CT_TEMPLATE=$(curl -s -I "${BASE}/datasets/${DATASET_ID}/csv/template" | grep -i "^content-type" | tr -d '\r')
echo "$CT_TEMPLATE" | grep -qi "text/csv" \
  && pass "CSV template Content-Type: text/csv" \
  || fail "CSV template Content-Type not text/csv: $CT_TEMPLATE"

CSV_DATA=$'input,expected_output\nWhat is 5+5?,10\nWhat is 6+6?,12'
R=$(curl_csv POST "/datasets/${DATASET_ID}/csv/preview" "$CSV_DATA")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Preview CSV → 200" 200 "$S"
VALID_ROW_COUNT=$(echo "$B" | jq -r '.validRowCount')
echo "    → validRowCount: $VALID_ROW_COUNT"
[[ "$VALID_ROW_COUNT" == "2" ]] && pass "CSV preview validRowCount=2" || fail "CSV preview validRowCount expected 2, got $VALID_ROW_COUNT (body: $B)"

R=$(curl_csv POST "/datasets/${DATASET_ID}/csv/import" "$CSV_DATA")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Import CSV → 200" 200 "$S"

R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$ITEMS_LEN" -ge 4 ]] \
  && pass "Dataset items increased to $ITEMS_LEN after CSV import" \
  || fail "Dataset items expected ≥4 after import, got $ITEMS_LEN"

HTTP_STATUS=$(curl -s -o /tmp/smoke_export.csv -w "%{http_code}" "${BASE}/datasets/${DATASET_ID}/csv/export")
assert_status "Export CSV → 200" 200 "$HTTP_STATUS"
CT_EXPORT=$(curl -s -I "${BASE}/datasets/${DATASET_ID}/csv/export" | grep -i "^content-type" | tr -d '\r')
echo "$CT_EXPORT" | grep -qi "text/csv" \
  && pass "CSV export Content-Type: text/csv" \
  || fail "CSV export Content-Type not text/csv: $CT_EXPORT"

# ─── REVISIONS ─────────────────────────────────────────────────────────────────
# Tests: GET /datasets/:id/revisions (list, verify multiple revisions exist after mutations),
#        GET /datasets/:id/revisions/:revisionId (get specific revision, verify items),
#        GET non-existent revision (404)
section "REVISIONS"

R=$(curl_get "/datasets/${DATASET_ID}/revisions")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "List revisions → 200" 200 "$S"
REV_COUNT=$(echo "$B" | jq '. | length')
[[ "$REV_COUNT" -gt 1 ]] && pass "Multiple revisions exist ($REV_COUNT)" || fail "Expected >1 revisions, got $REV_COUNT"

FIRST_REV_ID=$(echo "$B" | jq -r '.[0].id')
echo "    → Latest revision ID: $FIRST_REV_ID"
R=$(curl_get "/datasets/${DATASET_ID}/revisions/${FIRST_REV_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get revision by ID → 200" 200 "$S"
REV_ITEMS=$(echo "$B" | jq '.items | length')
[[ "$REV_ITEMS" -ge 1 ]] && pass "Revision has items ($REV_ITEMS items)" || fail "Revision has no items"

R=$(curl_get "/datasets/${DATASET_ID}/revisions/00000000-0000-0000-0000-000000000000")
S=$(status_of "$R")
assert_status "Get non-existent revision → 404" 404 "$S"

# ─── REVISION IMMUTABILITY ─────────────────────────────────────────────────────
# Tests copy-on-write semantics: previous revisions must NOT change when new items are added.
# Records the latest revision's item count, adds a new item (creating a new revision),
# then verifies the OLD revision still has the original item count.
section "REVISION IMMUTABILITY"

R=$(curl_get "/datasets/${DATASET_ID}/revisions")
B=$(body_of "$R")
IMMUT_REV_ID=$(echo "$B" | jq -r '.[0].id')
IMMUT_ITEM_COUNT=$(echo "$B" | jq '.[0].itemCount')
echo "    → Pinned revision: $IMMUT_REV_ID (itemCount: $IMMUT_ITEM_COUNT)"

R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 7+7?","expected_output":"14"}}')
S=$(status_of "$R")
assert_status "Add item for immutability test → 201" 201 "$S"

R=$(curl_get "/datasets/${DATASET_ID}/revisions/${IMMUT_REV_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get old revision after mutation → 200" 200 "$S"
OLD_REV_ITEMS=$(echo "$B" | jq '.items | length')
[[ "$OLD_REV_ITEMS" == "$IMMUT_ITEM_COUNT" ]] \
  && pass "Old revision still has $IMMUT_ITEM_COUNT items (immutable ✓)" \
  || fail "Old revision mutated! Expected $IMMUT_ITEM_COUNT items, got $OLD_REV_ITEMS"

# ─── GRADERS ───────────────────────────────────────────────────────────────────
# Tests: POST /graders (create), POST with empty rubric (400), POST missing name (400),
#        GET /graders (list), GET /graders/:id (get by ID),
#        PATCH /graders/:id (update name+rubric), PATCH description only,
#        GET non-existent grader (404)
section "GRADERS"

R=$(curl_json POST /graders '{"name":"accuracy-check","description":"Checks factual accuracy","rubric":"Evaluate whether the output matches the expected output. Consider semantic equivalence, not just exact string matching."}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create grader 'accuracy-check' → 201" 201 "$S"
GRADER_ID=$(echo "$B" | jq -r '.id')
echo "    → GRADER_ID: $GRADER_ID"

R=$(curl_json POST /graders '{"name":"bad-grader","description":"test","rubric":""}')
S=$(status_of "$R")
assert_status "Create grader with empty rubric → 400" 400 "$S"

R=$(curl_json POST /graders '{"rubric":"Some rubric"}')
S=$(status_of "$R")
assert_status "Create grader with missing name → 400" 400 "$S"

R=$(curl_get /graders)
S=$(status_of "$R")
assert_status "List graders → 200" 200 "$S"

R=$(curl_get "/graders/${GRADER_ID}")
S=$(status_of "$R")
assert_status "Get grader → 200" 200 "$S"

R=$(curl_json PATCH "/graders/${GRADER_ID}" '{"name":"updated-grader","rubric":"Updated rubric instructions"}')
S=$(status_of "$R")
assert_status "Update grader name + rubric → 200" 200 "$S"

R=$(curl_json PATCH "/graders/${GRADER_ID}" '{"description":"Now with better context"}')
S=$(status_of "$R")
assert_status "Update grader description only → 200" 200 "$S"

R=$(curl_get "/graders/00000000-0000-0000-0000-000000000000")
S=$(status_of "$R")
assert_status "Get non-existent grader → 404" 404 "$S"

# ─── EXPERIMENTS ───────────────────────────────────────────────────────────────
# Tests: POST /experiments (create + auto-enqueues, verify datasetRevisionId is set),
#        POST with no graders (400), POST with invalid datasetId (400),
#        GET /experiments (list), GET /experiments/:id (verify auto-enqueued status),
#        poll status until terminal, GET /experiments/:id/csv/export (if complete)
section "EXPERIMENTS"

R=$(curl_json POST /experiments \
  "{\"name\":\"eval-run-1\",\"datasetId\":\"${DATASET_ID}\",\"graderIds\":[\"${GRADER_ID}\"]}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create experiment → 201" 201 "$S"
EXPERIMENT_ID=$(echo "$B" | jq -r '.id')
EXP_DATASET_REV_ID=$(echo "$B" | jq -r '.datasetRevisionId')
echo "    → EXPERIMENT_ID: $EXPERIMENT_ID"
echo "    → datasetRevisionId: $EXP_DATASET_REV_ID"
[[ "$EXP_DATASET_REV_ID" != "null" && -n "$EXP_DATASET_REV_ID" ]] \
  && pass "Experiment has datasetRevisionId" \
  || fail "Experiment missing datasetRevisionId"

R=$(curl_json POST /experiments \
  "{\"name\":\"bad-exp\",\"datasetId\":\"${DATASET_ID}\",\"graderIds\":[]}")
S=$(status_of "$R")
assert_status "Create experiment with no graders → 400" 400 "$S"

R=$(curl_json POST /experiments \
  "{\"name\":\"bad-exp\",\"datasetId\":\"00000000-0000-0000-0000-000000000000\",\"graderIds\":[\"${GRADER_ID}\"]}")
S=$(status_of "$R")
assert_status "Create experiment with invalid datasetId → 400" 400 "$S"

R=$(curl_get /experiments)
S=$(status_of "$R")
assert_status "List experiments → 200" 200 "$S"

R=$(curl_get "/experiments/${EXPERIMENT_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get experiment → 200" 200 "$S"
EXP_STATUS=$(echo "$B" | jq -r '.status')
[[ "$EXP_STATUS" == "queued" || "$EXP_STATUS" == "running" ]] \
  && pass "Experiment auto-enqueued (status='$EXP_STATUS')" \
  || fail "Experiment not enqueued, unexpected status '$EXP_STATUS'"

# Poll for experiment completion (max 30s)
echo "    → Polling experiment status..."
POLL_TIMEOUT=30
POLL_ELAPSED=0
EXP_STATUS="unknown"
while [[ $POLL_ELAPSED -lt $POLL_TIMEOUT ]]; do
  sleep 1
  POLL_ELAPSED=$((POLL_ELAPSED + 1))
  R=$(curl_get "/experiments/${EXPERIMENT_ID}")
  B=$(body_of "$R")
  EXP_STATUS=$(echo "$B" | jq -r '.status')
  if [[ "$EXP_STATUS" == "complete" || "$EXP_STATUS" == "failed" ]]; then
    break
  fi
done
echo "    → Experiment status after ${POLL_ELAPSED}s: $EXP_STATUS"

R=$(curl_get "/experiments/${EXPERIMENT_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get experiment after run → 200" 200 "$S"
[[ "$EXP_STATUS" == "complete" || "$EXP_STATUS" == "failed" || "$EXP_STATUS" == "running" ]] \
  && pass "Experiment reached expected state: '$EXP_STATUS'" \
  || fail "Unexpected experiment status: '$EXP_STATUS'"

if [[ "$EXP_STATUS" == "complete" ]]; then
  HTTP_STATUS=$(curl -s -o /tmp/smoke_exp_export.csv -w "%{http_code}" \
    "${BASE}/experiments/${EXPERIMENT_ID}/csv/export")
  assert_status "Export experiment results CSV → 200" 200 "$HTTP_STATUS"
else
  echo -e "${YELLOW}    → Skipping experiment CSV export (status=$EXP_STATUS — OPENROUTER_API_KEY may not be set)${RESET}"
fi

# ─── EXPERIMENT PINNING ─────────────────────────────────────────────────────────
# Tests that re-running an experiment pins to the LATEST revision, not the original.
# Adds a new item (creating a new revision), then re-runs the experiment.
# The rerun's datasetRevisionId must differ from the original's.
section "EXPERIMENT PINNING"

R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 8+8?","expected_output":"16"}}')
S=$(status_of "$R")
assert_status "Add item to create new revision (for pinning test) → 201" 201 "$S"

R=$(curl_json POST "/experiments/${EXPERIMENT_ID}/rerun")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Rerun experiment → 201" 201 "$S"
RERUN_ID=$(echo "$B" | jq -r '.id')
RERUN_REV_ID=$(echo "$B" | jq -r '.datasetRevisionId')
echo "    → RERUN_ID: $RERUN_ID"
echo "    → Original datasetRevisionId: $EXP_DATASET_REV_ID"
echo "    → Rerun  datasetRevisionId:   $RERUN_REV_ID"

[[ "$RERUN_REV_ID" != "$EXP_DATASET_REV_ID" && "$RERUN_REV_ID" != "null" ]] \
  && pass "Rerun pinned to a different (newer) revision than original ✓" \
  || fail "Rerun has same datasetRevisionId as original — should be a newer revision"

# ─── SSE ───────────────────────────────────────────────────────────────────────
# Tests Server-Sent Events: connects to /experiments/:id/events and verifies
# the stream includes an 'event: connected' message. Uses --max-time 3 since
# the SSE stream stays open indefinitely.
section "SSE (Server-Sent Events)"

SSE_OUTPUT=$(curl -s -N --max-time 3 "${BASE}/experiments/${EXPERIMENT_ID}/events" 2>/dev/null || true)
echo "$SSE_OUTPUT" | grep -q "event: connected" \
  && pass "SSE stream returns 'event: connected'" \
  || fail "SSE stream missing 'event: connected' (got: ${SSE_OUTPUT:0:200})"

# ─── DELETION ──────────────────────────────────────────────────────────────────
# Tests: DELETE /experiments/:id (200), GET deleted (404),
#        DELETE /graders/:id (200), GET deleted (404)
section "DELETION"

R=$(curl_json DELETE "/experiments/${EXPERIMENT_ID}")
S=$(status_of "$R")
assert_status "Delete experiment → 200" 200 "$S"
DELETED_EXP_ID="$EXPERIMENT_ID"
EXPERIMENT_ID=""

R=$(curl_get "/experiments/${DELETED_EXP_ID}")
S=$(status_of "$R")
assert_status "Get deleted experiment → 404" 404 "$S"

curl_json DELETE "/experiments/${RERUN_ID}" > /dev/null 2>&1 || true
RERUN_ID=""

R=$(curl_json DELETE "/graders/${GRADER_ID}")
S=$(status_of "$R")
assert_status "Delete grader → 200" 200 "$S"
DELETED_GRADER_ID="$GRADER_ID"
GRADER_ID=""

R=$(curl_get "/graders/${DELETED_GRADER_ID}")
S=$(status_of "$R")
assert_status "Get deleted grader → 404" 404 "$S"

# ─── CASCADE DELETE ─────────────────────────────────────────────────────────────
# Tests Prisma cascade rules:
# 1. Create a dataset + item + grader + experiment (linked together)
# 2. Delete the DATASET → experiment should be cascade-deleted (404)
# 3. Grader should SURVIVE dataset deletion (200) — graders are independent
# 4. Clean up the surviving grader
section "CASCADE DELETE"

R=$(curl_json POST /datasets '{"name":"cascade-test"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create 'cascade-test' dataset → 201" 201 "$S"
CASCADE_DATASET_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_DATASET_ID: $CASCADE_DATASET_ID"

R=$(curl_json POST "/datasets/${CASCADE_DATASET_ID}/items" \
  '{"values":{"input":"cascade input","expected_output":"cascade output"}}')
S=$(status_of "$R")
assert_status "Create item in cascade dataset → 201" 201 "$S"

R=$(curl_json POST /graders \
  '{"name":"cascade-grader","description":"cascade test","rubric":"Cascade test rubric - verify output matches expected"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create 'cascade-grader' → 201" 201 "$S"
CASCADE_GRADER_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_GRADER_ID: $CASCADE_GRADER_ID"

R=$(curl_json POST /experiments \
  "{\"name\":\"cascade-exp\",\"datasetId\":\"${CASCADE_DATASET_ID}\",\"graderIds\":[\"${CASCADE_GRADER_ID}\"]}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create cascade experiment → 201" 201 "$S"
CASCADE_EXP_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_EXP_ID: $CASCADE_EXP_ID"

R=$(curl_json DELETE "/datasets/${CASCADE_DATASET_ID}")
S=$(status_of "$R")
assert_status "Delete cascade dataset → 200" 200 "$S"
CASCADE_DATASET_ID=""

R=$(curl_get "/experiments/${CASCADE_EXP_ID}")
S=$(status_of "$R")
assert_status "Get cascade experiment after dataset delete → 404 (cascaded)" 404 "$S"
CASCADE_EXP_ID=""

R=$(curl_get "/graders/${CASCADE_GRADER_ID}")
S=$(status_of "$R")
assert_status "Get cascade grader after dataset delete → 200 (grader survives)" 200 "$S"

R=$(curl_json DELETE "/graders/${CASCADE_GRADER_ID}")
S=$(status_of "$R")
assert_status "Delete cascade grader (cleanup) → 200" 200 "$S"
CASCADE_GRADER_ID=""

curl_json DELETE "/datasets/${DATASET_ID}" > /dev/null 2>&1 || true
DATASET_ID=""

# ─── SUMMARY ───────────────────────────────────────────────────────────────────
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
