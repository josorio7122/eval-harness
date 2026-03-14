#!/usr/bin/env bash
# seed.sh — Seeds the eval harness with the Customer Support QA dataset and 4 graders.
# Usage: ./seed.sh [API_URL]
# Requires: curl, jq
# Note: Each run creates new records. Run once against a fresh environment.

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

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Seed complete. Use these IDs to create an experiment:"
echo ""
echo "  Dataset ID:                  $DATASET_ID"
echo "  Grader 'Helpfulness':        $G1_ID"
echo "  Grader 'Tone & Empathy':     $G2_ID"
echo "  Grader 'Accuracy':           $G3_ID"
echo "  Grader 'Completeness':       $G4_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
