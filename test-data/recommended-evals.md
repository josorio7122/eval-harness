# Recommended Evals — Customer Support QA Dataset

Four graders for evaluating LLM responses against the Customer Support QA dataset. Each grader is designed to be used independently; running all four gives a comprehensive signal on response quality.

---

## 1. Helpfulness

**Description:** Evaluates whether the response actually answers the customer's question and provides clear, actionable next steps they can follow immediately.

**Rubric:**

You are evaluating a customer support response for helpfulness. A helpful response directly addresses the customer's question without deflecting, provides at least one concrete action the customer can take, and does not leave them stuck or needing to ask the same question again. Compare the actual response to the expected output: if the actual response answers the same core question and provides actionable guidance of equivalent quality, it passes. If the response is vague, only partially answers the question, redirects the customer without resolution, or omits critical steps that the expected output includes, it fails. Responses that ask a clarifying question are acceptable only when the question is genuinely necessary to proceed — not as a way to avoid answering. Score as PASS if the response is genuinely helpful and actionable, FAIL otherwise.

---

## 2. Tone & Empathy

**Description:** Evaluates whether the response is professional, appropriately empathetic, and calibrated to the customer's emotional state — neither cold and robotic nor over-apologetic.

**Rubric:**

You are evaluating a customer support response for tone and empathy. Read the customer's input carefully to assess their emotional state: are they frustrated, anxious, confused, or neutral? The response should acknowledge the customer's situation with language that matches that state — frustrated customers deserve a brief acknowledgment of the inconvenience before jumping to solutions, while neutral or curious customers don't need excessive apologies. A good response is warm and professional without being sycophantic or hollow ("Great question!" is not empathy). It should never be dismissive, condescending, or overly formal to the point of feeling cold. Compare against the expected output's tone as a benchmark. Score as PASS if the tone is appropriate and human, FAIL if the response feels robotic, dismissive, overly apologetic in a way that undermines confidence, or mismatched to the customer's emotional state.

---

## 3. Accuracy

**Description:** Evaluates whether the information in the response is factually correct and consistent with the expected output — no contradictions, fabricated details, or incorrect process descriptions.

**Rubric:**

You are evaluating a customer support response for factual accuracy. Using the expected output as the ground truth, check every factual claim in the actual response: process steps, timeframes, feature descriptions, policy details, and any specific numbers or URLs mentioned. The response fails if it contradicts the expected output on any material fact (e.g., claiming a refund takes 7 days when the expected output says 3–5, or describing a wrong navigation path). The response also fails if it invents specific details not present in the expected output that could mislead the customer (e.g., fabricating a support email address or a policy clause). Minor variation in wording or phrasing is acceptable as long as the underlying facts match. Omitting a fact is evaluated under Completeness, not here — this grader only penalizes incorrect or contradicted information. Score as PASS if all stated facts are accurate and consistent with the expected output, FAIL if any material inaccuracy or contradiction is present.

---

## 4. Completeness

**Description:** Evaluates whether the response addresses all parts of the customer's question without omitting important details that would leave the customer with unresolved concerns.

**Rubric:**

You are evaluating a customer support response for completeness. First, identify every distinct question or concern in the customer's input — some messages contain multiple issues (e.g., a billing dispute and a request for a receipt). Then check whether the actual response addresses each one. Use the expected output as a reference for which elements are considered important: if the expected output addresses three sub-questions and the actual response only addresses two, that is an incomplete response. Also check for important safety nets or caveats the expected output includes — for example, a fallback instruction if the primary resolution doesn't work, or a note about a time limit. A response that answers the main question but omits a critical caveat or secondary concern should be scored as FAIL. Responses that cover everything material in the expected output, even if in a different order or with slightly different framing, should be scored as PASS. Score as PASS if the response is fully complete, FAIL if it omits material information present in the expected output.
