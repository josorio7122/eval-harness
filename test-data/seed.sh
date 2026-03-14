#!/usr/bin/env bash
# seed.sh — Seeds the eval harness with the Customer Support QA dataset, 4 graders,
#           and 3 pre-seeded experiments with mixed pass/fail/error results.
# Usage: ./seed.sh [API_URL]
# Requires: curl, jq
# Note: Each run creates new records. Run once against a fresh environment.
# Note: psql runs inside the Docker container 'eval-harness-db' — no local psql needed.

set -euo pipefail

API_URL="${1:-http://localhost:3001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$SCRIPT_DIR/customer-support-dataset.csv"

# ── Helpers ──────────────────────────────────────────────────────────────────

check_deps() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "ERROR: '$cmd' is required but not installed." >&2
      exit 1
    fi
  done
}

post() {
  local path="$1"
  local body="$2"
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${API_URL}${path}"
}

assert_success() {
  local response="$1"
  local context="$2"
  local error
  error=$(echo "$response" | jq -r '.error // empty')
  if [ -n "$error" ]; then
    echo "ERROR: $context failed." >&2
    echo "Response: $response" >&2
    exit 1
  fi
}

# ── Step 1: Create dataset ────────────────────────────────────────────────────

echo "Creating dataset 'Customer Support QA'..."

DATASET_RESPONSE=$(post "/datasets" '{"name": "Customer Support QA"}')
assert_success "$DATASET_RESPONSE" "Create dataset"

DATASET_ID=$(echo "$DATASET_RESPONSE" | jq -r '.id')
echo "  ✓ Dataset created: $DATASET_ID"

# ── Step 2: Add custom attributes ────────────────────────────────────────────

echo "Adding attribute 'category'..."
ATTR1_RESPONSE=$(post "/datasets/$DATASET_ID/attributes" '{"name": "category"}')
assert_success "$ATTR1_RESPONSE" "Add attribute 'category'"
echo "  ✓ Attribute 'category' added"

echo "Adding attribute 'difficulty'..."
ATTR2_RESPONSE=$(post "/datasets/$DATASET_ID/attributes" '{"name": "difficulty"}')
assert_success "$ATTR2_RESPONSE" "Add attribute 'difficulty'"
echo "  ✓ Attribute 'difficulty' added"

# ── Step 3: Import CSV ────────────────────────────────────────────────────────

echo "Importing CSV from $CSV_FILE..."

if [ ! -f "$CSV_FILE" ]; then
  echo "ERROR: CSV file not found: $CSV_FILE" >&2
  exit 1
fi

IMPORT_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: text/plain" \
  --data-binary "@$CSV_FILE" \
  "${API_URL}/datasets/${DATASET_ID}/csv/import")
assert_success "$IMPORT_RESPONSE" "CSV import"
echo "  ✓ CSV imported successfully"

# ── Step 4: Create graders ────────────────────────────────────────────────────

echo "Creating graders..."

# Grader 1: Helpfulness
HELPFULNESS_BODY=$(jq -n \
  --arg name "Helpfulness" \
  --arg description "Evaluates whether the response provides clear, actionable guidance that directly resolves the customer's issue." \
  --arg rubric "Evaluate whether the response is genuinely useful to the customer. A helpful response directly addresses the customer's question, provides at least one concrete action the customer can take, and does not leave them stuck or needing to ask the same question again. The response PASSES if it gives the customer a clear path forward — specific steps, a resolution, or actionable guidance. The response FAILS if it is vague, deflects without answering, redirects the customer without resolution, or provides only generic advice that anyone could give without understanding the issue. Asking a clarifying question is acceptable only when genuinely necessary to proceed." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G1_RESPONSE=$(post "/graders" "$HELPFULNESS_BODY")
assert_success "$G1_RESPONSE" "Create grader 'Helpfulness'"
G1_ID=$(echo "$G1_RESPONSE" | jq -r '.id')
echo "  ✓ Grader 'Helpfulness' created: $G1_ID"

# Grader 2: Tone & Empathy
TONE_BODY=$(jq -n \
  --arg name "Tone & Empathy" \
  --arg description "Evaluates whether the response is professional, appropriately empathetic, and calibrated to the customer's emotional state — neither cold and robotic nor over-apologetic." \
  --arg rubric "Evaluate whether the response has an appropriate tone for the customer's emotional state. Read the customer's input to assess their state: frustrated, anxious, confused, or neutral. A frustrated customer deserves brief acknowledgment of the inconvenience before solutions. A neutral customer does not need excessive apologies. The response PASSES if the tone is warm, professional, and calibrated to the customer's state — it should feel human, not robotic or scripted. The response FAILS if it is dismissive, condescending, cold, overly formal, or mismatched to the emotional context (e.g., chipper and upbeat when the customer is angry, or profusely apologetic when the customer asked a simple factual question). Hollow phrases like 'Great question!' without substance are not empathy." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G2_RESPONSE=$(post "/graders" "$TONE_BODY")
assert_success "$G2_RESPONSE" "Create grader 'Tone & Empathy'"
G2_ID=$(echo "$G2_RESPONSE" | jq -r '.id')
echo "  ✓ Grader 'Tone & Empathy' created: $G2_ID"

# Grader 3: Accuracy
ACCURACY_BODY=$(jq -n \
  --arg name "Accuracy" \
  --arg description "Evaluates whether the response's factual claims are internally consistent and plausible — no self-contradictions or obviously implausible details." \
  --arg rubric "Evaluate whether the response contains factual claims that are internally consistent and reasonable in context. Check process steps, timeframes, feature descriptions, policy details, and specific numbers or URLs. The response PASSES if its claims are internally consistent and plausible for a real support interaction — specific details like timeframes, email addresses, or policy clauses are expected in good support responses and should NOT be penalized. The response FAILS only if it contains self-contradictions (e.g., saying '3–5 days' in one sentence and '7 days' in another), obviously implausible claims (e.g., a refund in 30 seconds), or information that directly contradicts something stated in the customer's input." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G3_RESPONSE=$(post "/graders" "$ACCURACY_BODY")
assert_success "$G3_RESPONSE" "Create grader 'Accuracy'"
G3_ID=$(echo "$G3_RESPONSE" | jq -r '.id')
echo "  ✓ Grader 'Accuracy' created: $G3_ID"

# Grader 4: Completeness
COMPLETENESS_BODY=$(jq -n \
  --arg name "Completeness" \
  --arg description "Evaluates whether the response addresses every question and concern in the customer's input without leaving them stuck or needing to follow up." \
  --arg rubric "Evaluate whether the response addresses every distinct question or concern in the customer's input. First, identify all questions and concerns — some messages contain multiple issues (e.g., a billing dispute and a request for a receipt). The response PASSES if it addresses each concern with enough detail that the customer would not need to ask again. The response FAILS if it ignores a question, only partially addresses a multi-part request, or omits critical information the customer clearly needs (e.g., answering 'how do I reset my password' without mentioning where to find the reset option). Minor omissions of nice-to-have details are acceptable — only penalize missing information that would leave the customer stuck or confused." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G4_RESPONSE=$(post "/graders" "$COMPLETENESS_BODY")
assert_success "$G4_RESPONSE" "Create grader 'Completeness'"
G4_ID=$(echo "$G4_RESPONSE" | jq -r '.id')
echo "  ✓ Grader 'Completeness' created: $G4_ID"

# ── Step 5: Seed experiments with results ────────────────────────────────────

echo "Seeding experiments with pre-computed results..."

# Fetch the latest revision ID and all item IDs for this dataset
REVISION_ID=$(docker exec eval-harness-db psql -U eval -d eval_harness -t -A -c \
  "SELECT id FROM \"DatasetRevision\" WHERE \"datasetId\" = '$DATASET_ID' ORDER BY \"createdAt\" DESC LIMIT 1;" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

if [ -z "$REVISION_ID" ]; then
  echo "ERROR: Could not find a revision for dataset $DATASET_ID" >&2
  exit 1
fi
echo "  ✓ Using revision: $REVISION_ID"

# Fetch all item IDs ordered deterministically
IFS=$'\n' read -r -d '' -a ITEM_IDS < <(docker exec eval-harness-db psql -U eval -d eval_harness -t -A -c \
  "SELECT id FROM \"DatasetRevisionItem\" WHERE \"revisionId\" = '$REVISION_ID' ORDER BY \"createdAt\", id;" && printf '\0')

ITEM_COUNT="${#ITEM_IDS[@]}"
if [ "$ITEM_COUNT" -eq 0 ]; then
  echo "ERROR: No items found in revision $REVISION_ID" >&2
  exit 1
fi
echo "  ✓ Found $ITEM_COUNT dataset items"

# ── Helper: build INSERT statements for one experiment ─────────────────────
# Arguments: $1=experiment_id  $2=grader_id  $3=pass_count  $4=fail_count
# The remaining items (up to ITEM_COUNT) become 'error'.
build_results_sql() {
  local exp_id="$1"
  local grader_id="$2"
  local pass_count="$3"
  local fail_count="$4"

  local pass_reasons=(
    "The response directly addresses the customer's concern with clear, actionable steps."
    "The reply resolves the issue efficiently and gives the customer a concrete path forward."
    "The response is thorough and leaves no ambiguity about the next steps."
    "The customer's question is answered completely with relevant detail."
    "The response provides specific guidance that would allow the customer to resolve their issue independently."
    "The reply is well-structured, accurate, and directly helpful."
    "All aspects of the customer's concern are addressed with appropriate depth."
    "The response is clear, professional, and fully resolves the reported issue."
  )
  local fail_reasons=(
    "The response is vague and doesn't provide specific steps the customer can follow."
    "The reply deflects without resolving the underlying issue."
    "The response offers only generic advice that fails to address the customer's specific situation."
    "Critical information is missing, leaving the customer without a clear resolution."
    "The reply acknowledges the issue but provides no actionable guidance."
    "The response is incomplete and would require the customer to follow up again."
    "The answer is off-topic and does not address what the customer asked."
    "The response contains contradictory information that would confuse the customer."
  )
  local error_reasons=(
    "Evaluation failed: rate limit exceeded"
    "Evaluation failed: model timeout"
  )

  local i=0
  local sql=""
  for item_id in "${ITEM_IDS[@]}"; do
    local verdict reason
    if [ "$i" -lt "$pass_count" ]; then
      verdict="pass"
      reason="${pass_reasons[$((i % ${#pass_reasons[@]}))]}"
    elif [ "$i" -lt $(( pass_count + fail_count )) ]; then
      local fi=$(( i - pass_count ))
      verdict="fail"
      reason="${fail_reasons[$((fi % ${#fail_reasons[@]}))]}"
    else
      local ei=$(( i - pass_count - fail_count ))
      verdict="error"
      reason="${error_reasons[$((ei % ${#error_reasons[@]}))]}"
    fi
    local sq="'" dq="''"
    reason="${reason//$sq/$dq}"  # escape single quotes for SQL
    sql+="INSERT INTO \"ExperimentResult\" (id, \"experimentId\", \"datasetRevisionItemId\", \"graderId\", verdict, reason)
  VALUES (gen_random_uuid(), '$exp_id', '$item_id', '$grader_id', '$verdict', '$reason')
  ON CONFLICT (\"experimentId\", \"datasetRevisionItemId\", \"graderId\") DO NOTHING;
"
    (( i++ )) || true
  done
  echo "$sql"
}

# ── Experiment 1: "Baseline GPT-4o Run" (high quality, openai/gpt-4o) ─────
echo "Creating experiment 'Baseline GPT-4o Run' (openai/gpt-4o)..."

EXP1_ID=$(docker exec eval-harness-db psql -U eval -d eval_harness -t -A -c \
  "INSERT INTO \"Experiment\" (id, name, \"datasetId\", \"datasetRevisionId\", status, \"modelId\")
   VALUES (gen_random_uuid(), 'Baseline GPT-4o Run', '$DATASET_ID', '$REVISION_ID', 'complete', 'openai/gpt-4o')
   RETURNING id;" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

docker exec eval-harness-db psql -U eval -d eval_harness -q -c \
  "INSERT INTO \"ExperimentGrader\" (\"experimentId\", \"graderId\") VALUES
   ('$EXP1_ID', '$G1_ID'),
   ('$EXP1_ID', '$G2_ID'),
   ('$EXP1_ID', '$G3_ID'),
   ('$EXP1_ID', '$G4_ID')
   ON CONFLICT DO NOTHING;"

# Helpfulness:    28 pass, 2 fail,  0 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP1_ID" "$G1_ID" 28 2)
SQL

# Tone & Empathy: 27 pass, 2 fail,  1 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP1_ID" "$G2_ID" 27 2)
SQL

# Accuracy:       29 pass, 1 fail,  0 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP1_ID" "$G3_ID" 29 1)
SQL

# Completeness:   24 pass, 5 fail,  1 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP1_ID" "$G4_ID" 24 5)
SQL

echo "  ✓ Experiment 1 created: $EXP1_ID"

# ── Experiment 2: "Gemini Flash Run" (medium quality, google/gemini-2.5-flash) ──
echo "Creating experiment 'Gemini Flash Run' (google/gemini-2.5-flash)..."

EXP2_ID=$(docker exec eval-harness-db psql -U eval -d eval_harness -t -A -c \
  "INSERT INTO \"Experiment\" (id, name, \"datasetId\", \"datasetRevisionId\", status, \"modelId\")
   VALUES (gen_random_uuid(), 'Gemini Flash Run', '$DATASET_ID', '$REVISION_ID', 'complete', 'google/gemini-2.5-flash')
   RETURNING id;" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

docker exec eval-harness-db psql -U eval -d eval_harness -q -c \
  "INSERT INTO \"ExperimentGrader\" (\"experimentId\", \"graderId\") VALUES
   ('$EXP2_ID', '$G1_ID'),
   ('$EXP2_ID', '$G2_ID'),
   ('$EXP2_ID', '$G3_ID'),
   ('$EXP2_ID', '$G4_ID')
   ON CONFLICT DO NOTHING;"

# Helpfulness:    20 pass, 8 fail,  2 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP2_ID" "$G1_ID" 20 8)
SQL

# Tone & Empathy: 22 pass, 7 fail,  1 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP2_ID" "$G2_ID" 22 7)
SQL

# Accuracy:       18 pass, 10 fail, 2 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP2_ID" "$G3_ID" 18 10)
SQL

# Completeness:   15 pass, 12 fail, 3 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP2_ID" "$G4_ID" 15 12)
SQL

echo "  ✓ Experiment 2 created: $EXP2_ID"

# ── Experiment 3: "Claude Haiku Run" (lower quality, anthropic/claude-haiku-4.5) ──
echo "Creating experiment 'Claude Haiku Run' (anthropic/claude-haiku-4.5)..."

EXP3_ID=$(docker exec eval-harness-db psql -U eval -d eval_harness -t -A -c \
  "INSERT INTO \"Experiment\" (id, name, \"datasetId\", \"datasetRevisionId\", status, \"modelId\")
   VALUES (gen_random_uuid(), 'Claude Haiku Run', '$DATASET_ID', '$REVISION_ID', 'complete', 'anthropic/claude-haiku-4.5')
   RETURNING id;" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

docker exec eval-harness-db psql -U eval -d eval_harness -q -c \
  "INSERT INTO \"ExperimentGrader\" (\"experimentId\", \"graderId\") VALUES
   ('$EXP3_ID', '$G1_ID'),
   ('$EXP3_ID', '$G2_ID'),
   ('$EXP3_ID', '$G3_ID'),
   ('$EXP3_ID', '$G4_ID')
   ON CONFLICT DO NOTHING;"

# Helpfulness:    14 pass, 14 fail, 2 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP3_ID" "$G1_ID" 14 14)
SQL

# Tone & Empathy: 16 pass, 12 fail, 2 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP3_ID" "$G2_ID" 16 12)
SQL

# Accuracy:       12 pass, 15 fail, 3 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP3_ID" "$G3_ID" 12 15)
SQL

# Completeness:   10 pass, 16 fail, 4 error
docker exec -i eval-harness-db psql -U eval -d eval_harness -q <<SQL
$(build_results_sql "$EXP3_ID" "$G4_ID" 10 16)
SQL

echo "  ✓ Experiment 3 created: $EXP3_ID"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Seed complete."
echo ""
echo "  Dataset ID:                  $DATASET_ID"
echo "  Grader 'Helpfulness':        $G1_ID"
echo "  Grader 'Tone & Empathy':     $G2_ID"
echo "  Grader 'Accuracy':           $G3_ID"
echo "  Grader 'Completeness':       $G4_ID"
echo ""
echo "  Experiment 'Baseline GPT-4o Run':  $EXP1_ID  (~90% pass)"
echo "  Experiment 'Gemini Flash Run':     $EXP2_ID  (~63% pass)"
echo "  Experiment 'Claude Haiku Run':     $EXP3_ID  (~43% pass)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
