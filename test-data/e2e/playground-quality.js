/**
 * Playground Quality E2E Test
 *
 * Runs real LLM conversations through the Prompt Playground UI and asserts
 * response quality: no template placeholders, appropriate tone, empathy,
 * resolution language, version-switching behaviour, and conversation reset.
 *
 * Tests:
 *  1. Professional Support Agent  — 3-turn billing conversation
 *  2. Empathetic Resolution Specialist — 2-turn account-lockout conversation
 *  3. Professional Support Agent  — version switching (v2 → v1)
 *
 * Prerequisites:
 *  - Dev server running:  pnpm run dev          (web on :5173, API on :3001)
 *  - DB seeded:           bash test-data/seed.sh
 *  - Playwright installed: npm install playwright  (or npx playwright install chromium)
 *
 * How to run:
 *  # Via the pi playwright skill runner:
 *  cd <playwright-skill-dir> && node run.js <project>/test-data/e2e/playground-quality.js
 *
 *  # Or directly with Node (requires playwright in node_modules or globally):
 *  node test-data/e2e/playground-quality.js
 *
 * Environment variables (all optional — defaults shown):
 *  FRONTEND_URL=http://localhost:5173
 *  API_URL=http://localhost:3001
 */

const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// ─── Resolve prompt IDs from the API ────────────────────────────────────────
// IDs are assigned at seed time so we look them up by name rather than
// hardcoding session-specific UUIDs.

async function resolvePromptIds() {
  const res = await fetch(`${API_URL}/prompts`);
  if (!res.ok) throw new Error(`GET /prompts failed: ${res.status}`);
  const prompts = await res.json();

  const find = (name) => {
    const match = prompts.find((p) => p.name === name);
    if (!match) throw new Error(`Prompt not found: "${name}". Did you run seed.sh?`);
    return match.id;
  };

  return {
    professionalSupportId: find('Professional Support Agent'),
    empatheticSpecialistId: find('Empathetic Resolution Specialist'),
  };
}

// ─── Quality check helpers ───────────────────────────────────────────────────

function hasPlaceholder(text) {
  return /\[your name\]|\[Your Name\]/i.test(text);
}

function hasEmailSignature(text) {
  // Match standalone email-closing lines (e.g. "Regards,\n") but not
  // mid-sentence uses such as "I sincerely apologize".
  return /(?:^|\n)\s*(regards|sincerely,|best regards|warm regards|kind regards|best,|yours truly|yours sincerely)\s*(?:\n|$)/im.test(
    text,
  );
}

function acknowledgesConcern(text) {
  return /\b(sorry|apologize|understand|frustrat|apologis)/i.test(text);
}

function mentionsResolution(text) {
  return /\b(refund|charge|resolve|correct|fix|review|look into|investigate|address)/i.test(text);
}

function mentionsTimeframe(text) {
  return /\b(\d+\s*(business\s*)?days?|hours?|week|within|typically|usually|processing)/i.test(text);
}

function showsEmpathyFirst(text) {
  const firstTwoHundred = text.slice(0, 200).toLowerCase();
  return /\b(sorry|apologize|understand|frustrat|terrible|awful|difficult|stress|distress|empathize|feel)/i.test(
    firstTwoHundred,
  );
}

function addressesAccountAccess(text) {
  return /\b(account|access|locked|password|reset|restore|recover|unlock)/i.test(text);
}

function hasWarmLanguage(text) {
  return /\b(absolutely|certainly|understand|here to help|happy to|glad to|right away|priority|urgent)/i.test(text);
}

function acknowledgesUrgency(text) {
  return /\b(urgent|right away|immediately|priority|deadline|tomorrow|as soon as|expedite|escalate)/i.test(text);
}

function offersConcreteHelp(text) {
  return /\b(steps?|process|verify|submit|ticket|escalate|team|specialist|contact|reach out|follow.?up)/i.test(text);
}

function maintainsRefundContext(text) {
  return /\b(refund|credit|charge|payment|billing)/i.test(text);
}

// ─── Wait for stable streaming response ─────────────────────────────────────

/**
 * Waits for the latest assistant message to stop streaming.
 *
 * Strategy:
 *  1. Wait for the Stop button to disappear (signals the LLM call finished).
 *  2. Poll the last assistant message until its text is stable (3 identical reads).
 *
 * Returns the final trimmed text.
 */
async function waitForStableResponse(page, timeoutMs = 90000) {
  const start = Date.now();

  // Phase 1: wait for Stop button to disappear (signals streaming complete)
  try {
    await page.waitForSelector('button:has-text("Stop")', { state: 'hidden', timeout: timeoutMs });
    console.log('  ℹ️  Stop button gone — streaming complete');
  } catch {
    // Very fast responses may never show the Stop button — continue anyway
    console.log('  ℹ️  Stop button wait timed out — checking text directly');
  }

  // Phase 2: poll until text is stable (3 identical reads, 500 ms apart)
  let stableCount = 0;
  let lastText = '';
  const remainingMs = timeoutMs - (Date.now() - start);
  const pollEnd = Date.now() + Math.max(remainingMs, 10000);

  while (Date.now() < pollEnd) {
    await page.waitForTimeout(500);

    // Assistant messages use justify-start (per playground-message.tsx)
    const assistantMessages = page.locator('.flex.justify-start');
    const count = await assistantMessages.count();

    if (count === 0) {
      stableCount = 0;
      lastText = '';
      continue;
    }

    const lastMsg = assistantMessages.last();
    const text = await lastMsg.innerText().catch(() => '');
    const trimmed = text.trim();

    if (trimmed === '') {
      stableCount = 0;
      continue;
    }

    // Still streaming if the animate-pulse cursor is present
    const isStreaming = (await lastMsg.locator('.animate-pulse').count()) > 0;
    if (isStreaming) {
      stableCount = 0;
      lastText = trimmed;
      continue;
    }

    if (trimmed === lastText && trimmed.length > 0) {
      stableCount++;
      if (stableCount >= 3) return trimmed;
    } else {
      stableCount = 0;
      lastText = trimmed;
    }
  }

  throw new Error(
    `Response did not stabilize within ${timeoutMs}ms. Last text: "${lastText.slice(0, 100)}"`,
  );
}

// ─── Page interaction helpers ────────────────────────────────────────────────

async function sendMessage(page, message) {
  const textarea = page.locator('textarea[placeholder*="Send a message"]');
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.fill(message);
  const sendBtn = page.locator('button').filter({ hasText: /^Send$/ });
  await sendBtn.click();
}

async function openPlayground(page, promptId) {
  await page.goto(`${FRONTEND_URL}/prompts/${promptId}`, { waitUntil: 'networkidle' });
  const playgroundBtn = page.locator('button').filter({ hasText: /Playground/ });
  await playgroundBtn.waitFor({ state: 'visible', timeout: 10000 });
  await playgroundBtn.click();
  await page.waitForSelector('text=Playground', { timeout: 10000 });
  await page.waitForSelector('text=Version', { timeout: 10000 });
  console.log('  ✅ Playground panel opened');
}

async function resetConversation(page) {
  const resetBtn = page.locator('button[title="Reset conversation"]');
  await resetBtn.click();
  await page.waitForTimeout(500);
  console.log('  🔄 Conversation reset');
}

async function closePlayground(page) {
  // playground-panel.tsx renders a DialogPrimitive.Close with an sr-only "Close" span
  const srClose = page.locator('button:has(span.sr-only:text("Close"))');
  if ((await srClose.count()) > 0) {
    await srClose.first().click();
  } else {
    await page.keyboard.press('Escape');
  }
  // Wait for slide-out animation + panel to leave the DOM
  await page.waitForTimeout(400);
  await page
    .waitForSelector('[data-slot="dialog-title"]:text("Playground")', { state: 'hidden', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  console.log('  ✅ Playground closed');
}

// ─── Results tracking ────────────────────────────────────────────────────────

const results = [];

function check(testName, turnLabel, description, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(
    `  ${icon} [${testName} / ${turnLabel}] ${description}${detail ? ': ' + detail : ''}`,
  );
  results.push({ testName, turnLabel, description, passed, detail });
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nResolving prompt IDs from ${API_URL}/prompts ...`);
  const { professionalSupportId, empatheticSpecialistId } = await resolvePromptIds();
  console.log(`  Professional Support Agent:    ${professionalSupportId}`);
  console.log(`  Empathetic Resolution Specialist: ${empatheticSpecialistId}`);

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  let allPassed = true;

  try {
    // ════════════════════════════════════════════════════════════════════
    // TEST 1: Professional Support Agent — 3-turn billing conversation
    // ════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Professional Support Agent — 3-turn conversation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await openPlayground(page, professionalSupportId);

    // — Turn 1: billing complaint ──────────────────────────────────────
    console.log('\n  Turn 1: Billing complaint');
    await sendMessage(page, 'I was charged twice for my subscription this month. This is unacceptable!');
    console.log('  ⏳ Waiting for response (up to 90s)...');
    const t1r1 = await waitForStableResponse(page, 90000);
    console.log(`  💬 Response (${t1r1.length} chars): "${t1r1.slice(0, 120)}..."`);

    check('T1-ProfSupport', 'Turn1', 'No placeholder [Your Name]', !hasPlaceholder(t1r1));
    check('T1-ProfSupport', 'Turn1', 'Acknowledges concern', acknowledgesConcern(t1r1));
    check('T1-ProfSupport', 'Turn1', 'Mentions resolution', mentionsResolution(t1r1));
    check('T1-ProfSupport', 'Turn1', 'Concise (under 800 chars)', t1r1.length < 800, `${t1r1.length} chars`);
    check('T1-ProfSupport', 'Turn1', 'No email signature', !hasEmailSignature(t1r1));

    // — Turn 2: refund timeline ───────────────────────────────────────
    console.log('\n  Turn 2: Refund timeline');
    await sendMessage(page, 'How long will the refund take to process?');
    console.log('  ⏳ Waiting for response...');
    const t1r2 = await waitForStableResponse(page, 45000);
    console.log(`  💬 Response (${t1r2.length} chars): "${t1r2.slice(0, 120)}..."`);

    check('T1-ProfSupport', 'Turn2', 'No placeholder', !hasPlaceholder(t1r2));
    check('T1-ProfSupport', 'Turn2', 'Mentions timeframe', mentionsTimeframe(t1r2));
    check('T1-ProfSupport', 'Turn2', 'Maintains refund context', maintainsRefundContext(t1r2));
    check('T1-ProfSupport', 'Turn2', 'No email signature', !hasEmailSignature(t1r2));

    // — Turn 3: acknowledgment ────────────────────────────────────────
    console.log('\n  Turn 3: Acknowledgment');
    await sendMessage(page, 'ok thanks');
    console.log('  ⏳ Waiting for response...');
    const t1r3 = await waitForStableResponse(page, 45000);
    console.log(`  💬 Response (${t1r3.length} chars): "${t1r3.slice(0, 120)}..."`);

    check('T1-ProfSupport', 'Turn3', 'No placeholder', !hasPlaceholder(t1r3));
    check('T1-ProfSupport', 'Turn3', 'Non-empty response', t1r3.trim().length > 0);
    check('T1-ProfSupport', 'Turn3', 'No email signature', !hasEmailSignature(t1r3));

    // — Reset & verify empty state ─────────────────────────────────────
    console.log('\n  Resetting conversation...');
    await resetConversation(page);
    await page.waitForTimeout(800);
    const emptyText = await page.locator('text=Send a message to start testing this prompt').count();
    check('T1-ProfSupport', 'Reset', 'Chat cleared after reset', emptyText > 0);

    await closePlayground(page);

    // ════════════════════════════════════════════════════════════════════
    // TEST 2: Empathetic Resolution Specialist — 2-turn account lockout
    // ════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Empathetic Resolution Specialist — 2-turn conversation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await openPlayground(page, empatheticSpecialistId);

    // — Turn 1: account lockout crisis ────────────────────────────────
    console.log('\n  Turn 1: Account lockout crisis');
    await sendMessage(
      page,
      "I've been locked out of my account for 3 days and nobody has helped me. I have critical work files in there!",
    );
    console.log('  ⏳ Waiting for response (up to 90s)...');
    const t2r1 = await waitForStableResponse(page, 90000);
    console.log(`  💬 Response (${t2r1.length} chars): "${t2r1.slice(0, 150)}..."`);

    check('T2-EmpathySpec', 'Turn1', 'No placeholder', !hasPlaceholder(t2r1));
    check('T2-EmpathySpec', 'Turn1', 'Shows empathy first', showsEmpathyFirst(t2r1));
    check('T2-EmpathySpec', 'Turn1', 'Addresses account access', addressesAccountAccess(t2r1));
    check('T2-EmpathySpec', 'Turn1', 'Warm language', hasWarmLanguage(t2r1));
    check('T2-EmpathySpec', 'Turn1', 'No email signature', !hasEmailSignature(t2r1));
    check('T2-EmpathySpec', 'Turn1', 'Under 2500 chars', t2r1.length < 2500, `${t2r1.length} chars`);

    // — Turn 2: urgency for client presentation ───────────────────────
    console.log('\n  Turn 2: Urgency for client presentation');
    await sendMessage(
      page,
      'I need those files by tomorrow morning for a client presentation. Can you prioritize this?',
    );
    console.log('  ⏳ Waiting for response...');
    const t2r2 = await waitForStableResponse(page, 45000);
    console.log(`  💬 Response (${t2r2.length} chars): "${t2r2.slice(0, 150)}..."`);

    check('T2-EmpathySpec', 'Turn2', 'No placeholder', !hasPlaceholder(t2r2));
    check('T2-EmpathySpec', 'Turn2', 'Acknowledges urgency', acknowledgesUrgency(t2r2));
    check('T2-EmpathySpec', 'Turn2', 'Offers concrete help', offersConcreteHelp(t2r2));
    check('T2-EmpathySpec', 'Turn2', 'No email signature', !hasEmailSignature(t2r2));

    await closePlayground(page);

    // ════════════════════════════════════════════════════════════════════
    // TEST 3: Professional Support Agent — version switching (v2 → v1)
    // ════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Professional Support Agent — version switching');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await openPlayground(page, professionalSupportId);

    // Verify defaults to v2 (latest version)
    // The version banner row contains the "VERSION" label + SelectTrigger
    const versionBanner = page.locator('.border-b').filter({ hasText: /Version/i }).last();
    const versionBannerText = await versionBanner.textContent().catch(() => '');
    console.log(`  Version banner: "${versionBannerText.trim()}"`);
    check('T3-VersionSwitch', 'Open', 'Defaults to latest version (v2)', /v2/i.test(versionBannerText));

    // — Send a message on v2 ──────────────────────────────────────────
    const testMsg = 'My dashboard is showing incorrect data';
    console.log('\n  Sending message on v2...');
    await sendMessage(page, testMsg);
    console.log('  ⏳ Waiting for v2 response...');
    const t3v2 = await waitForStableResponse(page, 90000);
    console.log(`  💬 v2 Response (${t3v2.length} chars): "${t3v2.slice(0, 120)}..."`);
    check('T3-VersionSwitch', 'v2', 'Got response on v2', t3v2.length > 0);

    // — Switch to v1 via the version picker ───────────────────────────
    console.log('\n  Switching to v1...');
    // The playground panel is a fixed right panel; scope selector to it
    const playgroundPanel = page.locator('.fixed.inset-y-0.right-0');
    const selectTrigger = playgroundPanel.locator('[role="combobox"]').first();
    await selectTrigger.waitFor({ state: 'visible', timeout: 5000 });
    await selectTrigger.click();
    await page.waitForTimeout(600);

    // Base UI Select renders options with role="option" in a portal
    const v1Option = page.locator('[role="option"]').filter({ hasText: /v1/ }).first();
    await v1Option.waitFor({ state: 'visible', timeout: 5000 });
    await v1Option.click();
    await page.waitForTimeout(800);

    // Verify the conversation cleared when switching versions
    const emptyClearedCount = await page
      .locator('text=Send a message to start testing this prompt')
      .count();
    check('T3-VersionSwitch', 'v1', 'Conversation clears on version switch', emptyClearedCount > 0);

    // Verify the version picker now shows v1
    const newVersionBannerText = await versionBanner.textContent().catch(() => '');
    console.log(`  Version banner now: "${newVersionBannerText.trim()}"`);
    check(
      'T3-VersionSwitch',
      'v1',
      'Version picker shows v1',
      /v1/i.test(newVersionBannerText) && !/v2/i.test(newVersionBannerText),
    );

    // — Send same message on v1 ───────────────────────────────────────
    console.log('\n  Sending same message on v1...');
    await sendMessage(page, testMsg);
    console.log('  ⏳ Waiting for v1 response...');
    const t3v1 = await waitForStableResponse(page, 90000);
    console.log(`  💬 v1 Response (${t3v1.length} chars): "${t3v1.slice(0, 120)}..."`);
    check('T3-VersionSwitch', 'v1', 'Got response on v1', t3v1.length > 0);

    await closePlayground(page);
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    await page.screenshot({ path: '/tmp/playground-quality-error.png' });
    console.log('  📸 Error screenshot: /tmp/playground-quality-error.png');
    allPassed = false;
  } finally {
    await page.waitForTimeout(1500);
    await browser.close();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(60));
  console.log('QUALITY CHECK SUMMARY');
  console.log('═'.repeat(60));

  const grouped = {};
  for (const r of results) {
    if (!grouped[r.testName]) grouped[r.testName] = [];
    grouped[r.testName].push(r);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  for (const [testName, checks] of Object.entries(grouped)) {
    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;
    totalPassed += passed;
    totalFailed += failed;
    console.log(`\n${testName}: ${passed}/${checks.length} passed`);
    for (const c of checks) {
      const icon = c.passed ? '  ✅' : '  ❌';
      console.log(`${icon} [${c.turnLabel}] ${c.description}${c.detail ? ' (' + c.detail + ')' : ''}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalPassed}/${totalPassed + totalFailed} checks passed`);
  if (totalFailed === 0) {
    console.log('🎉 ALL QUALITY CHECKS PASSED');
  } else {
    console.log(`⚠️  ${totalFailed} check(s) failed`);
    allPassed = false;
  }
  console.log('─'.repeat(60));

  process.exit(allPassed ? 0 : 1);
})();
