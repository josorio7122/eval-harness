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
  local success
  success=$(echo "$response" | jq -r '.success // false')
  if [ "$success" != "true" ]; then
    echo "ERROR: $context failed." >&2
    echo "Response: $response" >&2
    exit 1
  fi
}

# ── Step 1: Create dataset ────────────────────────────────────────────────────

echo "Creating dataset 'Customer Support QA'..."

DATASET_RESPONSE=$(post "/datasets" '{"name": "Customer Support QA"}')
assert_success "$DATASET_RESPONSE" "Create dataset"

DATASET_ID=$(echo "$DATASET_RESPONSE" | jq -r '.data.id')
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

CSV_CONTENT=$(cat "$CSV_FILE")
CSV_BODY=$(jq -n --arg content "$CSV_CONTENT" '{"content": $content}')

IMPORT_RESPONSE=$(post "/datasets/$DATASET_ID/csv/import" "$CSV_BODY")
assert_success "$IMPORT_RESPONSE" "CSV import"
echo "  ✓ CSV imported successfully"

# ── Step 4: Create graders ────────────────────────────────────────────────────

echo "Creating graders..."

# Grader 1: Helpfulness
HELPFULNESS_BODY=$(jq -n \
  --arg name "Helpfulness" \
  --arg description "Evaluates whether the response actually answers the customer's question and provides clear, actionable next steps they can follow immediately." \
  --arg rubric "You are evaluating a customer support response for helpfulness. A helpful response directly addresses the customer's question without deflecting, provides at least one concrete action the customer can take, and does not leave them stuck or needing to ask the same question again. Compare the actual response to the expected output: if the actual response answers the same core question and provides actionable guidance of equivalent quality, it passes. If the response is vague, only partially answers the question, redirects the customer without resolution, or omits critical steps that the expected output includes, it fails. Responses that ask a clarifying question are acceptable only when the question is genuinely necessary to proceed — not as a way to avoid answering. Score as PASS if the response is genuinely helpful and actionable, FAIL otherwise." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G1_RESPONSE=$(post "/graders" "$HELPFULNESS_BODY")
assert_success "$G1_RESPONSE" "Create grader 'Helpfulness'"
G1_ID=$(echo "$G1_RESPONSE" | jq -r '.data.id')
echo "  ✓ Grader 'Helpfulness' created: $G1_ID"

# Grader 2: Tone & Empathy
TONE_BODY=$(jq -n \
  --arg name "Tone & Empathy" \
  --arg description "Evaluates whether the response is professional, appropriately empathetic, and calibrated to the customer's emotional state — neither cold and robotic nor over-apologetic." \
  --arg rubric "You are evaluating a customer support response for tone and empathy. Read the customer's input carefully to assess their emotional state: are they frustrated, anxious, confused, or neutral? The response should acknowledge the customer's situation with language that matches that state — frustrated customers deserve a brief acknowledgment of the inconvenience before jumping to solutions, while neutral or curious customers don't need excessive apologies. A good response is warm and professional without being sycophantic or hollow (\"Great question!\" is not empathy). It should never be dismissive, condescending, or overly formal to the point of feeling cold. Compare against the expected output's tone as a benchmark. Score as PASS if the tone is appropriate and human, FAIL if the response feels robotic, dismissive, overly apologetic in a way that undermines confidence, or mismatched to the customer's emotional state." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G2_RESPONSE=$(post "/graders" "$TONE_BODY")
assert_success "$G2_RESPONSE" "Create grader 'Tone & Empathy'"
G2_ID=$(echo "$G2_RESPONSE" | jq -r '.data.id')
echo "  ✓ Grader 'Tone & Empathy' created: $G2_ID"

# Grader 3: Accuracy
ACCURACY_BODY=$(jq -n \
  --arg name "Accuracy" \
  --arg description "Evaluates whether the information in the response is factually correct and consistent with the expected output — no contradictions, fabricated details, or incorrect process descriptions." \
  --arg rubric "You are evaluating a customer support response for factual accuracy. Using the expected output as the ground truth, check every factual claim in the actual response: process steps, timeframes, feature descriptions, policy details, and any specific numbers or URLs mentioned. The response fails if it contradicts the expected output on any material fact (e.g., claiming a refund takes 7 days when the expected output says 3–5, or describing a wrong navigation path). The response also fails if it invents specific details not present in the expected output that could mislead the customer (e.g., fabricating a support email address or a policy clause). Minor variation in wording or phrasing is acceptable as long as the underlying facts match. Omitting a fact is evaluated under Completeness, not here — this grader only penalizes incorrect or contradicted information. Score as PASS if all stated facts are accurate and consistent with the expected output, FAIL if any material inaccuracy or contradiction is present." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G3_RESPONSE=$(post "/graders" "$ACCURACY_BODY")
assert_success "$G3_RESPONSE" "Create grader 'Accuracy'"
G3_ID=$(echo "$G3_RESPONSE" | jq -r '.data.id')
echo "  ✓ Grader 'Accuracy' created: $G3_ID"

# Grader 4: Completeness
COMPLETENESS_BODY=$(jq -n \
  --arg name "Completeness" \
  --arg description "Evaluates whether the response addresses all parts of the customer's question without omitting important details that would leave the customer with unresolved concerns." \
  --arg rubric "You are evaluating a customer support response for completeness. First, identify every distinct question or concern in the customer's input — some messages contain multiple issues (e.g., a billing dispute and a request for a receipt). Then check whether the actual response addresses each one. Use the expected output as a reference for which elements are considered important: if the expected output addresses three sub-questions and the actual response only addresses two, that is an incomplete response. Also check for important safety nets or caveats the expected output includes — for example, a fallback instruction if the primary resolution doesn't work, or a note about a time limit. A response that answers the main question but omits a critical caveat or secondary concern should be scored as FAIL. Responses that cover everything material in the expected output, even if in a different order or with slightly different framing, should be scored as PASS. Score as PASS if the response is fully complete, FAIL if it omits material information present in the expected output." \
  '{"name": $name, "description": $description, "rubric": $rubric}')

G4_RESPONSE=$(post "/graders" "$COMPLETENESS_BODY")
assert_success "$G4_RESPONSE" "Create grader 'Completeness'"
G4_ID=$(echo "$G4_RESPONSE" | jq -r '.data.id')
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
