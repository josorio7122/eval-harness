#!/usr/bin/env bash
# e2e-smoke.sh — Full API smoke test against http://localhost:3001
# Follows the order in docs/test.yml exactly.
# Safe to re-run: cleans up leftover test data at startup.

set -euo pipefail

BASE="http://localhost:3001"
PASS=0
FAIL=0

# ─── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────────────────
pass() {
  PASS=$((PASS + 1))
  echo -e "${GREEN}✅ PASS${RESET} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "${RED}❌ FAIL${RESET} — $1"
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
section "DATASETS"

# 1. Create dataset
R=$(curl_json POST /datasets '{"name":"smoke-test-dataset"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create dataset 'smoke-test-dataset'" 201 "$S"
DATASET_ID=$(echo "$B" | jq -r '.id')
echo "    → DATASET_ID: $DATASET_ID"

# 2. Duplicate name → 400
R=$(curl_json POST /datasets '{"name":"smoke-test-dataset"}')
S=$(status_of "$R")
assert_status "Create duplicate dataset name → 400" 400 "$S"

# 3. Empty name → 400
R=$(curl_json POST /datasets '{"name":""}')
S=$(status_of "$R")
assert_status "Create dataset with empty name → 400" 400 "$S"

# 4. List datasets → 200, verify our dataset is in array
sleep 1
R=$(curl_get /datasets)
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "List datasets → 200" 200 "$S"
COUNT=$(echo "$B" | jq --arg id "$DATASET_ID" '[.[] | select(.id == $id)] | length')
[[ "$COUNT" -ge 1 ]] && pass "List datasets contains smoke-test-dataset" || fail "List datasets does not contain smoke-test-dataset"

# 5. Get dataset by ID
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get dataset by ID → 200" 200 "$S"
NAME=$(echo "$B" | jq -r '.name')
SCHEMA_VER=$(echo "$B" | jq -r '.schemaVersion')
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$NAME" == "smoke-test-dataset" ]] && pass "Dataset name='smoke-test-dataset'" || fail "Dataset name mismatch: $NAME"
[[ "$SCHEMA_VER" == "1" ]] && pass "Dataset schemaVersion=1" || fail "schemaVersion expected 1, got $SCHEMA_VER"
[[ "$ITEMS_LEN" == "0" ]] && pass "Dataset items=[]" || fail "Dataset items expected empty, got $ITEMS_LEN"

# 6. Rename to "renamed-dataset"
R=$(curl_json PATCH "/datasets/${DATASET_ID}" '{"name":"renamed-dataset"}')
S=$(status_of "$R")
assert_status "Rename dataset → 200" 200 "$S"

# 7. Get again, verify name
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get renamed dataset → 200" 200 "$S"
NAME=$(echo "$B" | jq -r '.name')
[[ "$NAME" == "renamed-dataset" ]] && pass "Dataset name='renamed-dataset'" || fail "Rename failed: name='$NAME'"

# ─── ATTRIBUTES ────────────────────────────────────────────────────────────────
section "ATTRIBUTES"

# 8. Add attribute "context"
R=$(curl_json POST "/datasets/${DATASET_ID}/attributes" '{"name":"context"}')
S=$(status_of "$R")
assert_status "Add attribute 'context' → 201" 201 "$S"

# 9. Get dataset, verify attributes & schemaVersion=2
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ATTRS=$(echo "$B" | jq -c '.attributes')
SCHEMA_VER=$(echo "$B" | jq '.schemaVersion')
[[ "$ATTRS" == '["input","expected_output","context"]' ]] \
  && pass "attributes=['input','expected_output','context']" \
  || fail "attributes mismatch: $ATTRS"
[[ "$SCHEMA_VER" == "2" ]] && pass "schemaVersion=2 after add attribute" || fail "schemaVersion expected 2, got $SCHEMA_VER"

# 10. Add duplicate "input" → 400
R=$(curl_json POST "/datasets/${DATASET_ID}/attributes" '{"name":"input"}')
S=$(status_of "$R")
assert_status "Add duplicate attribute 'input' → 400" 400 "$S"

# 11. Remove builtin "input" → 400
R=$(curl_json DELETE "/datasets/${DATASET_ID}/attributes/input")
S=$(status_of "$R")
assert_status "Remove builtin attribute 'input' → 400" 400 "$S"

# 12. Remove "context" → 200
R=$(curl_json DELETE "/datasets/${DATASET_ID}/attributes/context")
S=$(status_of "$R")
assert_status "Remove attribute 'context' → 200" 200 "$S"

# 13. Get dataset, verify attributes & schemaVersion=3
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ATTRS=$(echo "$B" | jq -c '.attributes')
SCHEMA_VER=$(echo "$B" | jq '.schemaVersion')
[[ "$ATTRS" == '["input","expected_output"]' ]] \
  && pass "attributes=['input','expected_output'] after remove" \
  || fail "attributes mismatch after remove: $ATTRS"
[[ "$SCHEMA_VER" == "3" ]] && pass "schemaVersion=3 after remove attribute" || fail "schemaVersion expected 3, got $SCHEMA_VER"

# ─── ITEMS ─────────────────────────────────────────────────────────────────────
section "ITEMS"

# 14. Create item — use itemId from response
R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 2+2?","expected_output":"4"}}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create item → 201" 201 "$S"
ITEM_ID=$(echo "$B" | jq -r '.itemId')
echo "    → ITEM_ID: $ITEM_ID"

# 15. Get dataset, verify 1 item
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$ITEMS_LEN" == "1" ]] && pass "Dataset has 1 item" || fail "Dataset item count expected 1, got $ITEMS_LEN"

# 16. Update item
R=$(curl_json PATCH "/datasets/${DATASET_ID}/items/${ITEM_ID}" '{"values":{"input":"What is 3+3?","expected_output":"6"}}')
S=$(status_of "$R")
assert_status "Update item → 200" 200 "$S"

# 17. Get dataset, verify updated values
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
INPUT_VAL=$(echo "$B" | jq -r '.items[0].values.input')
OUTPUT_VAL=$(echo "$B" | jq -r '.items[0].values.expected_output')
[[ "$INPUT_VAL" == "What is 3+3?" ]] && pass "Item input updated to 'What is 3+3?'" || fail "Item input mismatch: $INPUT_VAL"
[[ "$OUTPUT_VAL" == "6" ]] && pass "Item expected_output updated to '6'" || fail "Item output mismatch: $OUTPUT_VAL"

# 18. Create second item
R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 4+4?","expected_output":"8"}}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create second item → 201" 201 "$S"
ITEM2_ID=$(echo "$B" | jq -r '.itemId')

# ─── CSV ───────────────────────────────────────────────────────────────────────
section "CSV"

# 19. Get CSV template → 200, Content-Type: text/csv
HTTP_STATUS=$(curl -s -o /tmp/smoke_template.csv -w "%{http_code}" "${BASE}/datasets/${DATASET_ID}/csv/template")
assert_status "Get CSV template → 200" 200 "$HTTP_STATUS"
CT_TEMPLATE=$(curl -s -I "${BASE}/datasets/${DATASET_ID}/csv/template" | grep -i "^content-type" | tr -d '\r')
echo "$CT_TEMPLATE" | grep -qi "text/csv" \
  && pass "CSV template Content-Type: text/csv" \
  || fail "CSV template Content-Type not text/csv: $CT_TEMPLATE"

# 20. Preview CSV → 200, verify row count field
CSV_DATA=$'input,expected_output\nWhat is 5+5?,10\nWhat is 6+6?,12'
R=$(curl_csv POST "/datasets/${DATASET_ID}/csv/preview" "$CSV_DATA")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Preview CSV → 200" 200 "$S"
TOTAL_ROWS=$(echo "$B" | jq -r '.totalRows // (.rows | length) // "unknown"' 2>/dev/null || echo "unknown")
echo "    → totalRows: $TOTAL_ROWS"
[[ "$TOTAL_ROWS" == "2" ]] && pass "CSV preview totalRows=2" || fail "CSV preview totalRows expected 2, got $TOTAL_ROWS (body: $B)"

# 21. Import CSV → 200
R=$(curl_csv POST "/datasets/${DATASET_ID}/csv/import" "$CSV_DATA")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Import CSV → 200" 200 "$S"

# 22. Get dataset, verify items increased (was 2, now should be 4)
R=$(curl_get "/datasets/${DATASET_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
ITEMS_LEN=$(echo "$B" | jq '.items | length')
[[ "$ITEMS_LEN" -ge 4 ]] \
  && pass "Dataset items increased to $ITEMS_LEN after CSV import" \
  || fail "Dataset items expected ≥4 after import, got $ITEMS_LEN"

# 23. Export CSV → 200, Content-Type: text/csv
HTTP_STATUS=$(curl -s -o /tmp/smoke_export.csv -w "%{http_code}" "${BASE}/datasets/${DATASET_ID}/csv/export")
assert_status "Export CSV → 200" 200 "$HTTP_STATUS"
CT_EXPORT=$(curl -s -I "${BASE}/datasets/${DATASET_ID}/csv/export" | grep -i "^content-type" | tr -d '\r')
echo "$CT_EXPORT" | grep -qi "text/csv" \
  && pass "CSV export Content-Type: text/csv" \
  || fail "CSV export Content-Type not text/csv: $CT_EXPORT"

# ─── REVISIONS ─────────────────────────────────────────────────────────────────
section "REVISIONS"

# 24. List revisions → 200, verify > 1
R=$(curl_get "/datasets/${DATASET_ID}/revisions")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "List revisions → 200" 200 "$S"
REV_COUNT=$(echo "$B" | jq '. | length')
[[ "$REV_COUNT" -gt 1 ]] && pass "Multiple revisions exist ($REV_COUNT)" || fail "Expected >1 revisions, got $REV_COUNT"

# 25. Get first (latest) revision → 200, verify it has items
FIRST_REV_ID=$(echo "$B" | jq -r '.[0].id')
echo "    → Latest revision ID: $FIRST_REV_ID"
R=$(curl_get "/datasets/${DATASET_ID}/revisions/${FIRST_REV_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get revision by ID → 200" 200 "$S"
REV_ITEMS=$(echo "$B" | jq '.items | length')
[[ "$REV_ITEMS" -ge 1 ]] && pass "Revision has items ($REV_ITEMS items)" || fail "Revision has no items"

# 26. Non-existent revision → 404
R=$(curl_get "/datasets/${DATASET_ID}/revisions/00000000-0000-0000-0000-000000000000")
S=$(status_of "$R")
assert_status "Get non-existent revision → 404" 404 "$S"

# ─── REVISION IMMUTABILITY ─────────────────────────────────────────────────────
section "REVISION IMMUTABILITY"

# 27. Record current latest revision ID and its item count
R=$(curl_get "/datasets/${DATASET_ID}/revisions")
B=$(body_of "$R")
IMMUT_REV_ID=$(echo "$B" | jq -r '.[0].id')
IMMUT_ITEM_COUNT=$(echo "$B" | jq '.[0].itemCount')
echo "    → Pinned revision: $IMMUT_REV_ID (itemCount: $IMMUT_ITEM_COUNT)"

# 28. Add a new item (creates new revision)
R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 7+7?","expected_output":"14"}}')
S=$(status_of "$R")
assert_status "Add item for immutability test → 201" 201 "$S"

# 29. Get OLD revision → verify same item count (immutable)
R=$(curl_get "/datasets/${DATASET_ID}/revisions/${IMMUT_REV_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get old revision after mutation → 200" 200 "$S"
OLD_REV_ITEMS=$(echo "$B" | jq '.items | length')
[[ "$OLD_REV_ITEMS" == "$IMMUT_ITEM_COUNT" ]] \
  && pass "Old revision still has $IMMUT_ITEM_COUNT items (immutable ✓)" \
  || fail "Old revision mutated! Expected $IMMUT_ITEM_COUNT items, got $OLD_REV_ITEMS"

# ─── GRADERS ───────────────────────────────────────────────────────────────────
section "GRADERS"

# 30. Create grader
R=$(curl_json POST /graders '{"name":"accuracy-check","description":"Checks factual accuracy","rubric":"Evaluate whether the output matches the expected output. Consider semantic equivalence, not just exact string matching."}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create grader 'accuracy-check' → 201" 201 "$S"
GRADER_ID=$(echo "$B" | jq -r '.id')
echo "    → GRADER_ID: $GRADER_ID"

# 31. Empty rubric → 400
R=$(curl_json POST /graders '{"name":"bad-grader","description":"test","rubric":""}')
S=$(status_of "$R")
assert_status "Create grader with empty rubric → 400" 400 "$S"

# 32. Missing name → 400
R=$(curl_json POST /graders '{"rubric":"Some rubric"}')
S=$(status_of "$R")
assert_status "Create grader with missing name → 400" 400 "$S"

# 33. List graders → 200
R=$(curl_get /graders)
S=$(status_of "$R")
assert_status "List graders → 200" 200 "$S"

# 34. Get grader → 200
R=$(curl_get "/graders/${GRADER_ID}")
S=$(status_of "$R")
assert_status "Get grader → 200" 200 "$S"

# 35. Update grader name + rubric → 200
R=$(curl_json PATCH "/graders/${GRADER_ID}" '{"name":"updated-grader","rubric":"Updated rubric instructions"}')
S=$(status_of "$R")
assert_status "Update grader name + rubric → 200" 200 "$S"

# 36. Update description only → 200
R=$(curl_json PATCH "/graders/${GRADER_ID}" '{"description":"Now with better context"}')
S=$(status_of "$R")
assert_status "Update grader description only → 200" 200 "$S"

# 37. Get non-existent grader → 404
R=$(curl_get "/graders/00000000-0000-0000-0000-000000000000")
S=$(status_of "$R")
assert_status "Get non-existent grader → 404" 404 "$S"

# ─── EXPERIMENTS ───────────────────────────────────────────────────────────────
section "EXPERIMENTS"

# 38. Create experiment → 201, verify datasetRevisionId present
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

# 39. No graders → 400
R=$(curl_json POST /experiments \
  "{\"name\":\"bad-exp\",\"datasetId\":\"${DATASET_ID}\",\"graderIds\":[]}")
S=$(status_of "$R")
assert_status "Create experiment with no graders → 400" 400 "$S"

# 40. Invalid datasetId → 400
R=$(curl_json POST /experiments \
  "{\"name\":\"bad-exp\",\"datasetId\":\"00000000-0000-0000-0000-000000000000\",\"graderIds\":[\"${GRADER_ID}\"]}")
S=$(status_of "$R")
assert_status "Create experiment with invalid datasetId → 400" 400 "$S"

# 41. List experiments → 200
R=$(curl_get /experiments)
S=$(status_of "$R")
assert_status "List experiments → 200" 200 "$S"

# 42. Get experiment → 200, verify status=queued
R=$(curl_get "/experiments/${EXPERIMENT_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get experiment → 200" 200 "$S"
EXP_STATUS=$(echo "$B" | jq -r '.status')
[[ "$EXP_STATUS" == "queued" ]] \
  && pass "Experiment status='queued'" \
  || fail "Experiment status expected 'queued', got '$EXP_STATUS'"

# 43. Run experiment → 202
R=$(curl_json POST "/experiments/${EXPERIMENT_ID}/run")
S=$(status_of "$R")
assert_status "Run experiment → 202" 202 "$S"

# 44. Wait 2 seconds for processing
echo "    → Waiting 2s for experiment processing..."
sleep 2

# 45. Get experiment → verify status is complete, failed, or running
R=$(curl_get "/experiments/${EXPERIMENT_ID}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Get experiment after run → 200" 200 "$S"
EXP_STATUS=$(echo "$B" | jq -r '.status')
echo "    → Experiment status after run: $EXP_STATUS"
[[ "$EXP_STATUS" == "complete" || "$EXP_STATUS" == "failed" || "$EXP_STATUS" == "running" ]] \
  && pass "Experiment reached expected state: '$EXP_STATUS'" \
  || fail "Unexpected experiment status: '$EXP_STATUS'"

# 46. If complete: export CSV → 200
if [[ "$EXP_STATUS" == "complete" ]]; then
  HTTP_STATUS=$(curl -s -o /tmp/smoke_exp_export.csv -w "%{http_code}" \
    "${BASE}/experiments/${EXPERIMENT_ID}/csv/export")
  assert_status "Export experiment results CSV → 200" 200 "$HTTP_STATUS"
else
  echo -e "${YELLOW}    → Skipping experiment CSV export (status=$EXP_STATUS — OPENROUTER_API_KEY may not be set)${RESET}"
fi

# ─── EXPERIMENT PINNING ─────────────────────────────────────────────────────────
section "EXPERIMENT PINNING"

# 47. Add new item to dataset (creates new revision)
R=$(curl_json POST "/datasets/${DATASET_ID}/items" '{"values":{"input":"What is 8+8?","expected_output":"16"}}')
S=$(status_of "$R")
assert_status "Add item to create new revision (for pinning test) → 201" 201 "$S"

# 48. Rerun experiment → 201, save RERUN_ID + new revisionId
R=$(curl_json POST "/experiments/${EXPERIMENT_ID}/rerun")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Rerun experiment → 201" 201 "$S"
RERUN_ID=$(echo "$B" | jq -r '.id')
RERUN_REV_ID=$(echo "$B" | jq -r '.datasetRevisionId')
echo "    → RERUN_ID: $RERUN_ID"
echo "    → Original datasetRevisionId: $EXP_DATASET_REV_ID"
echo "    → Rerun  datasetRevisionId:   $RERUN_REV_ID"

# 49. Verify rerun is pinned to a DIFFERENT (newer) revision
[[ "$RERUN_REV_ID" != "$EXP_DATASET_REV_ID" && "$RERUN_REV_ID" != "null" ]] \
  && pass "Rerun pinned to a different (newer) revision than original ✓" \
  || fail "Rerun has same datasetRevisionId as original — should be a newer revision"

# ─── SSE ───────────────────────────────────────────────────────────────────────
section "SSE (Server-Sent Events)"

# 50. Verify SSE connection — curl --max-time 3 (macOS-compatible alternative to `timeout`)
SSE_OUTPUT=$(curl -s -N --max-time 3 "${BASE}/experiments/${EXPERIMENT_ID}/events" 2>/dev/null || true)
echo "$SSE_OUTPUT" | grep -q "event: connected" \
  && pass "SSE stream returns 'event: connected'" \
  || fail "SSE stream missing 'event: connected' (got: ${SSE_OUTPUT:0:200})"

# ─── DELETION ──────────────────────────────────────────────────────────────────
section "DELETION"

# 51. Delete experiment → 200
R=$(curl_json DELETE "/experiments/${EXPERIMENT_ID}")
S=$(status_of "$R")
assert_status "Delete experiment → 200" 200 "$S"

# 52. Get deleted experiment → 404
R=$(curl_get "/experiments/${EXPERIMENT_ID}")
S=$(status_of "$R")
assert_status "Get deleted experiment → 404" 404 "$S"

# Clean up rerun quietly
curl_json DELETE "/experiments/${RERUN_ID}" > /dev/null 2>&1 || true

# 53. Delete grader → 200
R=$(curl_json DELETE "/graders/${GRADER_ID}")
S=$(status_of "$R")
assert_status "Delete grader → 200" 200 "$S"

# 54. Get deleted grader → 404
R=$(curl_get "/graders/${GRADER_ID}")
S=$(status_of "$R")
assert_status "Get deleted grader → 404" 404 "$S"

# ─── CASCADE DELETE ─────────────────────────────────────────────────────────────
section "CASCADE DELETE"

# 55. Create fresh "cascade-test" dataset
R=$(curl_json POST /datasets '{"name":"cascade-test"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create 'cascade-test' dataset → 201" 201 "$S"
CASCADE_DATASET_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_DATASET_ID: $CASCADE_DATASET_ID"

# 56. Create item in cascade dataset
R=$(curl_json POST "/datasets/${CASCADE_DATASET_ID}/items" \
  '{"values":{"input":"cascade input","expected_output":"cascade output"}}')
S=$(status_of "$R")
assert_status "Create item in cascade dataset → 201" 201 "$S"

# 57. Create cascade grader
R=$(curl_json POST /graders \
  '{"name":"cascade-grader","description":"cascade test","rubric":"Cascade test rubric - verify output matches expected"}')
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create 'cascade-grader' → 201" 201 "$S"
CASCADE_GRADER_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_GRADER_ID: $CASCADE_GRADER_ID"

# 58. Create cascade experiment
R=$(curl_json POST /experiments \
  "{\"name\":\"cascade-exp\",\"datasetId\":\"${CASCADE_DATASET_ID}\",\"graderIds\":[\"${CASCADE_GRADER_ID}\"]}")
B=$(body_of "$R"); S=$(status_of "$R")
assert_status "Create cascade experiment → 201" 201 "$S"
CASCADE_EXP_ID=$(echo "$B" | jq -r '.id')
echo "    → CASCADE_EXP_ID: $CASCADE_EXP_ID"

# 59. Delete cascade dataset — should cascade to its experiments
R=$(curl_json DELETE "/datasets/${CASCADE_DATASET_ID}")
S=$(status_of "$R")
assert_status "Delete cascade dataset → 200" 200 "$S"

# 60. Get cascade experiment → 404 (cascaded)
R=$(curl_get "/experiments/${CASCADE_EXP_ID}")
S=$(status_of "$R")
assert_status "Get cascade experiment after dataset delete → 404 (cascaded)" 404 "$S"

# 61. Get cascade grader → 200 (grader should still exist, not cascaded)
R=$(curl_get "/graders/${CASCADE_GRADER_ID}")
S=$(status_of "$R")
assert_status "Get cascade grader after dataset delete → 200 (grader survives)" 200 "$S"

# 62. Delete cascade grader (cleanup)
R=$(curl_json DELETE "/graders/${CASCADE_GRADER_ID}")
S=$(status_of "$R")
assert_status "Delete cascade grader (cleanup) → 200" 200 "$S"

# Clean up main dataset
curl_json DELETE "/datasets/${DATASET_ID}" > /dev/null 2>&1 || true

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
