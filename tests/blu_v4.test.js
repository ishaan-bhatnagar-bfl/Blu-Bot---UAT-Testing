'use strict';
/**
 * BLU UAT v4.0
 *
 * Fixes over v3.5:
 * - Retry loop fix: don't re-check retry if new bot message already arrived
 * - Multi-turn runtime detection: detect follow-up patterns dynamically
 * - Dynamic sample data per follow-up type
 * - CSV report output alongside JSON
 * - Reads from blu_test_cases_v4.json
 * - Supports FILTER_MODULE env var
 * - scoring_type: auto (key phrase match) vs manual (presence only)
 */

const { test } = require('@playwright/test');
const fs       = require('fs');
const path     = require('path');

const VERSION = 'v4.0';

const cfg      = JSON.parse(fs.readFileSync(path.resolve('run_config.json'), 'utf-8'));
const allCases = JSON.parse(fs.readFileSync(path.resolve('data/blu_test_cases_v4.json'), 'utf-8'));

// ─── THINKING PHRASES ────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  'checking', 'hold on', 'kindly wait', 'just a moment',
  'working on it', 'confirming', 'please wait', 'one moment',
  'fetching', 'loading', 'processing',
];

function isThinkingState(text) {
  const lower = text.toLowerCase().trim();
  return THINKING_PHRASES.some(p => lower.includes(p)) && lower.length < 80;
}

// ─── FOLLOW-UP DETECTION & SAMPLE DATA ───────────────────────────────────────

const FOLLOWUP_PATTERNS = [
  // EMI Calculation
  {
    pattern: /loan amount|interest rate|tenure|calculate.*emi|emi.*calculat/i,
    response: 'Loan amount: 500000, Interest rate: 12%, Tenure: 24 months',
    type: 'emi_calc',
  },
  // Product type
  {
    pattern: /which.*loan|which.*product|personal loan.*home loan|specify.*product|specify.*loan/i,
    response: 'Personal Flexi Loan',
    type: 'product_type',
  },
  // Loan variant
  {
    pattern: /flexi hybrid|term loan|variant|type of loan/i,
    response: 'Flexi Hybrid',
    type: 'loan_variant',
  },
  // Account / relation
  {
    pattern: /account number|loan number|relation|which account/i,
    response: 'Please use the first active loan',
    type: 'account_select',
  },
  // Date / amount generic
  {
    pattern: /amount|date|when|how much/i,
    response: 'Amount: 10000, Date: 15th of this month',
    type: 'amount_date',
  },
  // Generic follow-up fallback
  {
    pattern: /provide|share|please tell|enter|specify|select/i,
    response: 'Please proceed with sample data: loan amount 500000, tenure 24 months, interest rate 12%',
    type: 'generic',
  },
];

function detectFollowUp(botReply) {
  const lower = botReply.toLowerCase();

  // Bot is asking for relation selection chips — handled separately
  if (lower.includes('select the relation') || lower.includes('select the product to move further')) {
    return { isFollowUp: false, isRelation: true };
  }

  for (const fp of FOLLOWUP_PATTERNS) {
    if (fp.pattern.test(botReply)) {
      return { isFollowUp: true, isRelation: false, response: fp.response, type: fp.type };
    }
  }

  return { isFollowUp: false, isRelation: false };
}

// ─── SCORING ─────────────────────────────────────────────────────────────────

function scoreResult(tc, botReply) {
  if (!botReply || botReply.trim().length === 0) {
    return { overall: 'Fail', reason: 'Empty reply', matched_phrases: '', cta_found: 'No' };
  }

  const errorPhrases = [
    'facing a temporary issue', 'something went wrong', 'unable to process',
    'technical error', 'please try again later',
  ];
  if (errorPhrases.some(e => botReply.toLowerCase().includes(e))) {
    return { overall: 'Fail', reason: 'Bot error', matched_phrases: '', cta_found: 'No' };
  }

  // Manual review (relational/dynamic answers)
  if (tc.scoring_type === 'manual') {
    return { overall: 'Manual Review', reason: 'Dynamic answer — human review needed', matched_phrases: '', cta_found: 'N/A' };
  }

  // Auto scoring — key phrase match
  const replyLower = botReply.toLowerCase();
  const matched = [];
  const phrases = tc.expected_key_phrases || [];

  phrases.forEach(phrase => {
    if (phrase && replyLower.includes(phrase.toLowerCase())) {
      matched.push(phrase);
    }
  });

  // CTA check
  let ctaFound = 'N/A';
  if (tc.cta_expected === 'Yes') {
    const ctaIndicators = [
      'click', 'tap', 'apply', 'visit', 'document center', 'access',
      'start', 'raise', 'get started', 'open', 'view',
    ];
    ctaFound = ctaIndicators.some(c => replyLower.includes(c)) ? 'Yes' : 'No';
  }

  // Pass criteria: at least 1 key phrase matched (or no phrases defined), CTA found if expected
  const phrasePass = phrases.length === 0 || matched.length > 0;
  const ctaPass    = tc.cta_expected !== 'Yes' || ctaFound === 'Yes';
  const overall    = phrasePass && ctaPass ? 'Pass' : 'Fail';

  return {
    overall,
    reason:          overall === 'Fail'
      ? (!phrasePass ? 'No key phrases matched' : 'CTA not found')
      : '',
    matched_phrases: matched.join(' | '),
    cta_found:       ctaFound,
  };
}

// ─── DOM HELPERS ─────────────────────────────────────────────────────────────

async function clearAndType(page, locator, text) {
  await locator.waitFor({ state: 'visible', timeout: 30000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ force: true });
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: 12 });
}

async function submitFromComposer(page, locator) {
  const method = await locator.evaluate(el => {
    let node = el;
    for (let i = 0; i < 9; i++) {
      const parent = node?.parentElement;
      if (!parent) break;
      for (const b of parent.querySelectorAll('button')) {
        if (!b.disabled) { b.click(); return 'button'; }
      }
      for (const r of parent.querySelectorAll('[role="button"]')) {
        if (!r.closest('button')) { r.click(); return 'role-button'; }
      }
      const imgs = parent.querySelectorAll('img');
      for (const img of imgs) {
        if (window.getComputedStyle(img).cursor === 'pointer') {
          img.click(); return 'img-pointer';
        }
      }
      if (imgs.length) { imgs[imgs.length - 1].click(); return 'img-last'; }
      node = parent;
    }
    return null;
  }).catch(() => null);
  if (!method) await locator.press('Enter').catch(() => {});
  return method || 'enter';
}

async function botMessageCount(page) {
  return page.locator('.blu-bot-message.message').count().catch(() => 0);
}

async function waitForFinalBotReply(page, beforeCount, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  // Wait for new message to appear
  await page.waitForFunction(
    count => document.querySelectorAll('.blu-bot-message.message').length > count,
    beforeCount,
    { timeout: timeoutMs }
  );

  // Wait for thinking state to resolve
  while (Date.now() < deadline) {
    const msgs   = await page.locator('.blu-bot-message.message').all();
    const last   = msgs[msgs.length - 1];
    const text   = last ? (await last.innerText().catch(() => '')) : '';

    if (text && !isThinkingState(text)) return text.trim();
    await page.waitForTimeout(1500);
  }

  throw new Error('Bot reply timeout');
}

// ─── RETRY HANDLER ───────────────────────────────────────────────────────────
// Fix: only dismiss retry if no new bot message has arrived since beforeCount

async function dismissRetryIfPresent(page, beforeCount, maxWaitMs = 40000) {
  const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  const isVisible = await btn.isVisible().catch(() => false);
  if (!isVisible) return false;

  // Check if bot already replied — if so, retry is stale, don't click
  const currentCount = await botMessageCount(page);
  if (currentCount > beforeCount) {
    console.log('    ↳ Retry visible but bot already replied — skipping');
    return false;
  }

  console.log('  🟠 Retry detected — waiting for cooldown...');
  const interval = 2000;
  const maxAttempts = Math.ceil(maxWaitMs / interval);

  for (let i = 0; i < maxAttempts; i++) {
    const enabled = await btn.isEnabled().catch(() => false);
    if (enabled) {
      await btn.click({ force: true });
      console.log(`    ↳ Clicked after ${i * interval / 1000}s`);
      await page.waitForTimeout(2000);
      return true;
    }
    await page.waitForTimeout(interval);
  }

  console.log('    ↳ Retry never became clickable');
  return false;
}

// Quick dismiss for non-critical retries
async function dismissRetry(page) {
  const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  let attempts = 0;
  while (await btn.isVisible().catch(() => false) && attempts < 3) {
    const enabled = await btn.isEnabled().catch(() => false);
    if (enabled) {
      await btn.click({ force: true });
      await page.waitForTimeout(2000);
    } else break;
    attempts++;
  }
}

// ─── CONSENT ─────────────────────────────────────────────────────────────────

async function isConsentPending(page) {
  return page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    return checkboxes.some(cb => !cb.checked);
  }).catch(() => false);
}

async function acceptConsent(page) {
  const pending = await isConsentPending(page);
  if (!pending) return false;

  const checkbox  = page.locator('input[type="checkbox"]').first();
  const acceptBtn = page.locator('button.blu-primary-button').last();

  await checkbox.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);

  const box = await checkbox.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await checkbox.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(400);

  const checked = await checkbox.evaluate(el => el.checked).catch(() => false);
  if (!checked) {
    await checkbox.evaluate(el => {
      el.checked = true;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).catch(() => {});
    await page.waitForTimeout(400);
  }

  for (let w = 0; w < 6; w++) {
    await page.waitForTimeout(500);
    if (await acceptBtn.isEnabled().catch(() => false)) break;
  }

  await acceptBtn.scrollIntoViewIfNeeded().catch(() => {});
  await acceptBtn.click({ force: true });
  await page.waitForTimeout(2500);
  await dismissRetry(page);
  return true;
}

// ─── HOME / CHIPS WAIT ────────────────────────────────────────────────────────

async function waitForHome(page) {
  await Promise.race([
    page.locator('text=What you can do next').first().waitFor({ state: 'visible', timeout: 60000 }),
    page.locator('text=Need help?').first().waitFor({ state: 'visible', timeout: 60000 }),
    page.locator('text=Products we recommend').first().waitFor({ state: 'visible', timeout: 60000 }),
  ]);
  await dismissRetry(page);
  if (await isConsentPending(page)) await acceptConsent(page);
}

// ─── RELATION SELECTION ───────────────────────────────────────────────────────

async function selectRelationChip(page, chipText) {
  if (chipText === 'AUTO') {
    // Click first available active chip
    const chips = page.locator('.chip, [role="button"]').filter({ hasText: /active|open/i });
    const count = await chips.count().catch(() => 0);
    if (count > 0) {
      await chips.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      return true;
    }
    // Fallback: first chip
    const anyChip = page.locator('.chip, [role="button"]').first();
    if (await anyChip.isVisible().catch(() => false)) {
      await anyChip.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      return true;
    }
    return false;
  }

  const chip = page.locator('.chip, [role="button"]').filter({ hasText: new RegExp(chipText, 'i') }).first();
  if (!await chip.isVisible().catch(() => false)) return false;
  await chip.click({ force: true });
  await page.waitForTimeout(2000);
  return true;
}

async function selectRelationByL1(page, l1Category) {
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');

  const needsRelation = bodyText.includes('Please select the relation') ||
                        bodyText.includes('select the product to move further') ||
                        bodyText.includes('multiple product relation');

  if (!needsRelation) return false;

  console.log(`  🔧 Relation selection — L1: ${l1Category}`);

  const l1Lower = l1Category.toLowerCase();
  let level1Chip = null;

  if (l1Lower.includes('loan'))    level1Chip = 'Loan';
  else if (l1Lower.includes('card'))       level1Chip = 'Cards';
  else if (l1Lower.includes('insurance'))  level1Chip = 'Insurance';
  else if (l1Lower.includes('deposit'))    level1Chip = 'Investment';
  else if (l1Lower.includes('wallet'))     level1Chip = 'Wallet';
  else if (l1Lower.includes('upi'))        level1Chip = 'UPI';

  if (!level1Chip) {
    console.log('    ↳ Unknown L1 — trying AUTO');
    return selectRelationChip(page, 'AUTO');
  }

  const clicked = await selectRelationChip(page, level1Chip);
  if (!clicked) return false;

  await page.waitForTimeout(3000);

  // Check if Level 2 selection needed
  const bodyText2 = await page.evaluate(() => document.body.innerText).catch(() => '');
  const needsLevel2 = /active|closed|personal loan|emi card|flexi/i.test(bodyText2);

  if (needsLevel2) {
    await selectRelationChip(page, 'AUTO');
    await page.waitForTimeout(2000);
  }

  return true;
}

// ─── CSV REPORT WRITER ───────────────────────────────────────────────────────

function initCSV(filePath) {
  const headers = [
    'TC ID', 'Module', 'L1', 'L2', 'L3',
    'Utterance', 'Bot Reply', 'Expected Key Phrases', 'Matched Phrases',
    'CTA Expected', 'CTA Found', 'Overall', 'Reason',
    'Follow-up Rounds', 'Time (ms)',
    'Mapping Type', 'Mapping Confidence', 'Scoring Type',
  ];
  fs.writeFileSync(filePath, headers.map(h => `"${h}"`).join(',') + '\n');
}

function appendCSVRow(filePath, row) {
  const escaped = row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
  fs.appendFileSync(filePath, escaped.join(',') + '\n');
}

// ─── MAIN TEST ────────────────────────────────────────────────────────────────

test('BLU UAT', async ({ page, context }) => {
  const BLU_URL      = process.env.BLU_URL         || cfg.BLU_URL;
  const BLU_MOBILE   = process.env.BLU_MOBILE      || cfg.BLU_MOBILE;
  const BLU_OTP      = process.env.BLU_OTP         || cfg.BLU_OTP;
  const BATCH_SIZE   = parseInt(process.env.BATCH_SIZE   || cfg.BATCH_SIZE   || '20');
  const FILTER_L1    = process.env.FILTER_L1        || cfg.FILTER_L1        || '';
  const FILTER_MOD   = process.env.FILTER_MODULE    || cfg.FILTER_MODULE    || '';
  const FILTER_L2    = process.env.FILTER_L2        || cfg.FILTER_L2        || '';
  const DELAY_MS     = parseInt(process.env.DELAY_MS || cfg.DELAY_BETWEEN_MSGS_MS || '2000');
  const BOT_TIMEOUT  = parseInt(cfg.BOT_REPLY_TIMEOUT_MS || '45000');

  // ── Filter ──
  let filtered = allCases;
  if (FILTER_MOD) filtered = filtered.filter(tc => tc.module === FILTER_MOD);
  if (FILTER_L1)  filtered = filtered.filter(tc => tc.l1.toLowerCase() === FILTER_L1.toLowerCase());
  if (FILTER_L2)  filtered = filtered.filter(tc => tc.l2.toLowerCase() === FILTER_L2.toLowerCase());
  filtered = filtered.slice(0, BATCH_SIZE);

  console.log(`\n🔧 BLU UAT ${VERSION}`);
  console.log(`📋 ${filtered.length} test cases`);
  if (FILTER_MOD) console.log(`   Module: ${FILTER_MOD}`);
  if (FILTER_L1)  console.log(`   L1: ${FILTER_L1}`);
  if (FILTER_L2)  console.log(`   L2: ${FILTER_L2}`);
  console.log('');

  if (filtered.length === 0) {
    console.log('⚠️  No test cases matched filters. Check FILTER_MODULE / FILTER_L1 values.');
    return;
  }

  // ── Setup results ──
  fs.mkdirSync('results', { recursive: true });
  fs.mkdirSync('results/screenshots', { recursive: true });
  const RUN_TS       = new Date().toISOString().replace(/[:.]/g, '-');
  const JSON_FILE    = `results/run_${RUN_TS}.json`;
  const CSV_FILE     = `results/run_${RUN_TS}.csv`;

  initCSV(CSV_FILE);

  const runResults = {
    version:    VERSION,
    run_ts:     RUN_TS,
    filter:     { module: FILTER_MOD, l1: FILTER_L1, l2: FILTER_L2 },
    total:      filtered.length,
    passed:     0,
    failed:     0,
    manual:     0,
    pass_rate:  '',
    results:    [],
  };

  // ── Auth ──
  await context.grantPermissions(['geolocation'], { origin: new URL(BLU_URL).origin });
  await context.setGeolocation({ latitude: 18.5204, longitude: 73.8567 });

  console.log(`🚀 ${BLU_URL}`);
  await page.goto(BLU_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismissRetry(page);

  console.log('🔐 Entering mobile...');
  const mobileBox = page.getByRole('textbox', { name: /enter your mobile number/i }).first();
  await mobileBox.waitFor({ state: 'visible', timeout: 40000 });
  await clearAndType(page, mobileBox, BLU_MOBILE);
  const mobileSubmit = await submitFromComposer(page, mobileBox);
  console.log(`  ↳ Submit: ${mobileSubmit}`);

  await page.waitForTimeout(3000);

  console.log('🔐 Entering OTP...');
  const otpBox = page.getByRole('textbox', { name: /otp|6.?digit/i }).first();
  await otpBox.waitFor({ state: 'visible', timeout: 20000 });
  await clearAndType(page, otpBox, BLU_OTP);
  const otpSubmit = await submitFromComposer(page, otpBox);
  console.log(`  ↳ Submit: ${otpSubmit}`);

  await page.locator('text=/otp has been successfully validated/i').first()
    .waitFor({ state: 'visible', timeout: 35000 });
  console.log('✅ OTP validated\n');

  await waitForHome(page);
  console.log('✅ Home ready\n');

  const composer = page.locator('textarea, [contenteditable="true"]').first();
  await composer.waitFor({ state: 'visible', timeout: 30000 });

  let passed = 0, failed = 0, manual = 0;

  // ── Test loop ──
  for (let i = 0; i < filtered.length; i++) {
    const tc        = filtered[i];
    const startTime = Date.now();

    console.log(`\n[${i + 1}/${filtered.length}] ${tc.id} | ${tc.module}`);
    console.log(`  L2: ${tc.l2} | L3: ${tc.l3}`);
    console.log(`  💬 "${tc.utterance.slice(0, 80)}${tc.utterance.length > 80 ? '…' : ''}"`);

    await dismissRetry(page);
    if (await isConsentPending(page)) await acceptConsent(page);

    let beforeCount = await botMessageCount(page);
    let botReply    = '';
    let timedOut    = false;
    let followUpRounds = 0;

    // Send utterance
    await clearAndType(page, composer, tc.utterance);
    await submitFromComposer(page, composer);

    // Wait for initial reply
    try {
      // Poll for retry while waiting
      const replyPromise = waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT);
      const retryPromise = (async () => {
        await page.waitForTimeout(5000);
        await dismissRetryIfPresent(page, beforeCount);
      })();

      botReply = await replyPromise;
      await retryPromise.catch(() => {});
    } catch {
      await dismissRetryIfPresent(page, beforeCount);
      try {
        botReply = await waitForFinalBotReply(page, beforeCount, 20000);
      } catch {
        timedOut = true;
        console.log('  ⚠️  Timeout on initial reply');
      }
    }

    // ── Multi-turn loop ──────────────────────────────────────────────────────
    const MAX_FOLLOWUPS = 3;

    while (!timedOut && botReply && followUpRounds < MAX_FOLLOWUPS) {
      const detection = detectFollowUp(botReply);

      if (detection.isRelation) {
        // Bot is asking for relation selection
        console.log('  🔧 Bot requested relation selection...');
        await page.waitForTimeout(1500);
        const countBeforeRelation = await botMessageCount(page);
        await selectRelationByL1(page, tc.l1);
        await page.waitForTimeout(3000);
        const countAfterRelation = await botMessageCount(page);

        if (countAfterRelation > countBeforeRelation) {
          try {
            botReply = await waitForFinalBotReply(page, countBeforeRelation, BOT_TIMEOUT);
            console.log('  ✅ Reply after relation');
          } catch {
            console.log('  ⚠️  No reply after relation');
            timedOut = true;
          }
        } else {
          console.log('  ⚠️  No new message after relation click');
          timedOut = true;
        }
        break; // relation selection only happens once
      }

      if (detection.isFollowUp) {
        followUpRounds++;
        console.log(`  🔄 Follow-up ${followUpRounds} (${detection.type}): "${detection.response}"`);

        beforeCount = await botMessageCount(page);
        await page.waitForTimeout(1500);
        await clearAndType(page, composer, detection.response);
        await submitFromComposer(page, composer);

        try {
          botReply = await waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT);
        } catch {
          console.log(`  ⚠️  Timeout on follow-up ${followUpRounds}`);
          timedOut = true;
          break;
        }
        continue;
      }

      break; // No follow-up needed — final answer received
    }

    // ── Score ────────────────────────────────────────────────────────────────
    const elapsed = Date.now() - startTime;
    const scores  = timedOut
      ? { overall: 'Fail', reason: 'Timeout', matched_phrases: '', cta_found: 'N/A' }
      : scoreResult(tc, botReply);

    if (scores.overall === 'Pass')          passed++;
    else if (scores.overall === 'Fail')     failed++;
    else if (scores.overall === 'Manual Review') manual++;

    const icon = scores.overall === 'Pass' ? '✅'
               : scores.overall === 'Manual Review' ? '🔍' : '❌';

    console.log(`  🤖 ${botReply.slice(0, 100)}${botReply.length > 100 ? '…' : ''}`);
    console.log(`  ${icon} ${scores.overall} | CTA:${scores.cta_found} | ${elapsed}ms`);
    if (scores.reason) console.log(`     Reason: ${scores.reason}`);

    // ── Write results ────────────────────────────────────────────────────────
    const resultRow = {
      tc_id:              tc.id,
      module:             tc.module,
      l1:                 tc.l1,
      l2:                 tc.l2,
      l3:                 tc.l3,
      utterance:          tc.utterance,
      bot_reply:          botReply.slice(0, 1000),
      expected_key_phrases: (tc.expected_key_phrases || []).join(' | '),
      matched_phrases:    scores.matched_phrases,
      cta_expected:       tc.cta_expected,
      cta_found:          scores.cta_found,
      overall:            scores.overall,
      reason:             scores.reason || '',
      follow_up_rounds:   followUpRounds,
      elapsed_ms:         elapsed,
      mapping_type:       tc.mapping_type,
      mapping_confidence: tc.mapping_confidence,
      scoring_type:       tc.scoring_type,
    };

    runResults.results.push(resultRow);

    appendCSVRow(CSV_FILE, [
      resultRow.tc_id,
      resultRow.module,
      resultRow.l1,
      resultRow.l2,
      resultRow.l3,
      resultRow.utterance,
      resultRow.bot_reply,
      resultRow.expected_key_phrases,
      resultRow.matched_phrases,
      resultRow.cta_expected,
      resultRow.cta_found,
      resultRow.overall,
      resultRow.reason,
      resultRow.follow_up_rounds,
      resultRow.elapsed_ms,
      resultRow.mapping_type,
      resultRow.mapping_confidence,
      resultRow.scoring_type,
    ]);

    fs.writeFileSync(JSON_FILE, JSON.stringify(runResults, null, 2));
    await page.waitForTimeout(DELAY_MS);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const total    = passed + failed + manual;
  const passRate = total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%';

  runResults.passed   = passed;
  runResults.failed   = failed;
  runResults.manual   = manual;
  runResults.pass_rate = passRate;
  fs.writeFileSync(JSON_FILE, JSON.stringify(runResults, null, 2));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`BLU UAT ${VERSION}`);
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  🔍 Manual Review: ${manual}`);
  console.log(`Pass Rate: ${passRate} (excl. manual review)`);
  console.log(`📄 JSON: ${JSON_FILE}`);
  console.log(`📊 CSV:  ${CSV_FILE}`);
  console.log(`${'═'.repeat(60)}\n`);
});
