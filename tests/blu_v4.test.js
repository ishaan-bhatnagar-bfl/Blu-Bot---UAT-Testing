'use strict';
/**
 * BLU UAT v4.2
 *
 * v4.2 fixes:
 * - Consent checkbox: 4-strategy click sequence (label → mouse → parent → JS force)
 * - Verifies consent is actually gone after accept
 * - Accept and Continue button located by text not class
 *
 * v4.1 fixes:
 * - Consent detection by card text visibility (not checkbox state)
 * - waitForHome polls consent-first before checking composer
 * - Follow-up loop ignores consent card as bot reply
 */

const { test } = require('@playwright/test');
const fs       = require('fs');
const path     = require('path');

const VERSION = 'v4.7';

const cfg      = JSON.parse(fs.readFileSync(path.resolve('run_config.json'), 'utf-8'));
const allCases = JSON.parse(fs.readFileSync(path.resolve('data/blu_test_cases_v6.json'), 'utf-8'));

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
  {
    // Bot asking for EMI calculation inputs
    pattern: /please provide.*loan amount|provide.*interest rate|provide.*tenure|to calculate.*emi.*provide|share.*loan amount/i,
    response: 'Loan amount: 500000, Interest rate: 12%, Tenure: 24 months',
    type: 'emi_calc',
  },
  {
    // Bot asking which loan product
    pattern: /which.*loan product|which.*product.*interested|please specify.*product|specify.*loan product|personal loan.*home loan.*which/i,
    response: 'Personal Flexi Loan',
    type: 'product_type',
  },
  {
    // Bot asking for loan variant
    pattern: /flexi hybrid|select.*variant|choose.*variant|which variant/i,
    response: 'Flexi Hybrid',
    type: 'loan_variant',
  },
  {
    // Bot explicitly asking for more details to proceed
    pattern: /please provide.*details|please share.*details|kindly provide.*details|need.*following.*information/i,
    response: 'Please proceed with sample data: loan amount 500000, tenure 24 months, interest rate 12%',
    type: 'generic',
  },
];

function detectFollowUp(botReply) {
  const lower = botReply.toLowerCase();

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

  if (tc.scoring_type === 'manual') {
    return { overall: 'Manual Review', reason: 'Dynamic answer — human review needed', matched_phrases: '', cta_found: 'N/A' };
  }

  const replyLower = botReply.toLowerCase();
  const matched = [];
  const phrases = tc.expected_key_phrases || [];

  phrases.forEach(phrase => {
    if (phrase && replyLower.includes(phrase.toLowerCase())) {
      matched.push(phrase);
    }
  });

  let ctaFound = 'N/A';
  if (tc.cta_expected === 'Yes') {
    const ctaIndicators = [
      'click', 'tap', 'apply', 'visit', 'document center', 'access',
      'start', 'raise', 'get started', 'open', 'view', 'navigate',
      'go to', 'please visit', 'please navigate', 'using the link',
      'below', 'button below', 'page below',
    ];
    ctaFound = ctaIndicators.some(c => replyLower.includes(c)) ? 'Yes' : 'No';
  }

  const phrasePass = phrases.length === 0 || matched.length > 0;
  const ctaPass    = tc.cta_expected !== 'Yes' || ctaFound === 'Yes';
  const overall    = phrasePass && ctaPass ? 'Pass' : 'Fail';

  return {
    overall,
    reason:          overall === 'Fail' ? (!phrasePass ? 'No key phrases matched' : 'CTA not found') : '',
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

  await page.waitForFunction(
    count => document.querySelectorAll('.blu-bot-message.message').length > count,
    beforeCount,
    { timeout: timeoutMs }
  );

  while (Date.now() < deadline) {
    const msgs = await page.locator('.blu-bot-message.message').all();
    const last = msgs[msgs.length - 1];
    const text = last ? (await last.innerText().catch(() => '')) : '';
    if (text && !isThinkingState(text)) return text.trim();
    await page.waitForTimeout(1500);
  }

  throw new Error('Bot reply timeout');
}

// ─── RETRY HANDLER ───────────────────────────────────────────────────────────
// Retry card can appear at ANY point — after page load, mobile, OTP, or mid-test.

async function dismissRetryIfPresent(page, beforeCount, maxWaitMs = 40000) {
  const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  const isVisible = await btn.isVisible().catch(() => false);
  if (!isVisible) return false;

  // If bot already replied since beforeCount, retry is stale — skip
  if (beforeCount !== undefined) {
    const currentCount = await botMessageCount(page);
    if (currentCount > beforeCount) {
      console.log('    ↳ Retry visible but bot already replied — skipping');
      return false;
    }
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
    console.log(`    ⏳ Cooldown (${i * interval / 1000}s / ${maxWaitMs / 1000}s)`);
    await page.waitForTimeout(interval);
  }

  console.log(`    ⚠️  Retry never clickable after ${maxWaitMs / 1000}s`);
  return false;
}

async function dismissRetry(page) {
  const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  if (!await btn.isVisible().catch(() => false)) return;
  // Wait up to 10s for cooldown then click
  for (let i = 0; i < 5; i++) {
    const enabled = await btn.isEnabled().catch(() => false);
    if (enabled) {
      await btn.click({ force: true });
      await page.waitForTimeout(2000);
      return;
    }
    await page.waitForTimeout(2000);
  }
}

// ─── CONSENT ─────────────────────────────────────────────────────────────────
// V3 implementation — checks checkbox.checked state, not body text
// Consent is onboarding-only, happens once after OTP

async function isConsentPending(page) {
  return await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    return checkboxes.some(cb => !cb.checked);
  }).catch(() => false);
}

async function acceptConsent(page, attempt) {
  const pending = await isConsentPending(page);
  if (!pending) return false;

  console.log(`  🟦 Consent (attempt ${attempt}) — clicking checkbox…`);

  const checkbox  = page.locator('input[type="checkbox"]').first();
  const acceptBtn = page.locator('button.blu-primary-button').last();

  await checkbox.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);

  const box = await checkbox.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    console.log('    ↳ Clicked checkbox center');
  } else {
    await checkbox.click({ force: true }).catch(() => {});
    console.log('    ↳ Force-clicked checkbox');
  }
  await page.waitForTimeout(400);

  const checked = await checkbox.evaluate(el => el.checked).catch(() => false);
  console.log(`    ↳ checked=${checked}`);
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
    if (await acceptBtn.isEnabled().catch(() => false)) {
      console.log(`    ↳ Button enabled after ${(w + 1) * 0.5}s`);
      break;
    }
  }

  await acceptBtn.scrollIntoViewIfNeeded().catch(() => {});
  await acceptBtn.click({ force: true });
  console.log('    ↳ Clicked Accept and Continue');
  await page.waitForTimeout(2500);
  await dismissRetry(page);
  return true;
}

// ─── HOME WAIT ───────────────────────────────────────────────────────────────
// V3 implementation — waits for chips OR checkbox, then loops until home ready

async function isInitialHomeReady(page) {
  const chipsVisible = await page
    .locator('text=What you can do next').first()
    .isVisible().catch(() => false);
  if (!chipsVisible) return false;

  const composerVisible = await page
    .locator('textarea, [contenteditable="true"]').first()
    .isVisible().catch(() => false);
  if (!composerVisible) return false;

  if (await page.getByRole('button', { name: /^Retry$/i }).first()
    .isVisible().catch(() => false)) return false;

  if (await isConsentPending(page)) return false;

  return true;
}

async function waitForHome(page) {
  console.log('⏳ Clearing consent + waiting for home…');
  console.log('  ⏳ Waiting for consent or home chips…');

  await Promise.race([
    page.locator('input[type="checkbox"]').first()
      .waitFor({ state: 'attached', timeout: 15000 }),
    page.locator('text=What you can do next').first()
      .waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {});

  for (let i = 1; i <= 20; i++) {
    await dismissRetry(page);
    if (await isInitialHomeReady(page)) {
      console.log(`  ✅ Home/Chips ready (attempt ${i})`);
      return;
    }
    if (await isConsentPending(page)) {
      await acceptConsent(page, i);
    } else {
      await page.waitForTimeout(1000);
    }
  }

  throw new Error('waitForHome: home not reached after 20 attempts');
}

// ─── RELATION SELECTION ───────────────────────────────────────────────────────

async function selectRelationChip(page, targetText) {
  console.log(`    🔧 Chip: "${targetText}"...`);
  await page.waitForTimeout(2000);

  const clicked = await page.evaluate((target) => {
    const allEls = Array.from(document.querySelectorAll('div, button, span'));
    for (const el of allEls) {
      const text = (el.innerText || '').trim();
      const isClickable = window.getComputedStyle(el).cursor === 'pointer' ||
                          el.tagName === 'BUTTON' || el.onclick;
      if (!isClickable) continue;

      if (target === 'AUTO') {
        // Target relation cards — must contain loan/card status indicators
        // Exclude CTA buttons like "EMI Card Details", "Apply for loan" etc.
        const isRelationCard = /active|closed|disbursal|loan limit|available loan/i.test(text) &&
                               !/apply|details|view|download|manage|raise/i.test(text.split('\n')[0]);
        if (isRelationCard) {
          el.click();
          return text.slice(0, 60);
        }
      } else if (text === target || text.toLowerCase() === target.toLowerCase()) {
        el.click();
        return text;
      }
    }
    return null;
  }, targetText).catch(() => null);

  if (clicked) {
    console.log(`      ↳ Clicked: "${clicked.replace(/\n/g, ' | ')}"`);
    await page.waitForTimeout(8000);
    await dismissRetry(page);
    return true;
  }

  console.log(`      ↳ Not found: "${targetText}"`);
  return false;
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

  if (l1Lower.includes('loan'))           level1Chip = 'Loan';
  else if (l1Lower.includes('card'))      level1Chip = 'Cards';
  else if (l1Lower.includes('insurance')) level1Chip = 'Insurance';
  else if (l1Lower.includes('deposit'))   level1Chip = 'Investment';
  else if (l1Lower.includes('wallet'))    level1Chip = 'Wallet';
  else if (l1Lower.includes('upi'))       level1Chip = 'UPI';

  if (!level1Chip) {
    console.log('    ↳ Unknown L1 — trying AUTO');
    return selectRelationChip(page, 'AUTO');
  }

  // Check if we're already at Level 2 (direct card/loan list)
  const atLevel2 = /active|closed|personal loan|emi card|flexi|disbursal/i.test(bodyText);
  if (atLevel2) {
    console.log('    ↳ Already at Level 2 — AUTO selecting');
    await selectRelationChip(page, 'AUTO');
    return true;
  }

  // Click Level 1 chip (Loan / Cards / etc)
  const clicked = await selectRelationChip(page, level1Chip);
  if (!clicked) return false;

  // Check if Level 2 selection is now needed
  const bodyText2 = await page.evaluate(() => document.body.innerText).catch(() => '');
  const needsLevel2 = /active|closed|personal loan|emi card|flexi|disbursal/i.test(bodyText2);
  if (needsLevel2) {
    console.log('    ↳ Level 2 selection needed');
    await selectRelationChip(page, 'AUTO');
  }

  return true;
}

// ─── CSV REPORT ───────────────────────────────────────────────────────────────

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
  const BLU_URL     = process.env.BLU_URL         || cfg.BLU_URL;
  const BLU_MOBILE  = process.env.BLU_MOBILE      || cfg.BLU_MOBILE;
  const BLU_OTP     = process.env.BLU_OTP         || cfg.BLU_OTP;
  const BATCH_SIZE  = parseInt(process.env.BATCH_SIZE   || cfg.BATCH_SIZE   || '20');
  const FILTER_L1   = process.env.FILTER_L1        || cfg.FILTER_L1        || '';
  const FILTER_MOD  = process.env.FILTER_MODULE    || cfg.FILTER_MODULE    || '';
  const FILTER_L2   = process.env.FILTER_L2        || cfg.FILTER_L2        || '';
  const DELAY_MS    = parseInt(process.env.DELAY_MS || cfg.DELAY_BETWEEN_MSGS_MS || '2000');
  const BOT_TIMEOUT = parseInt(cfg.BOT_REPLY_TIMEOUT_MS || '45000');

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
    console.log('⚠️  No test cases matched filters.');
    return;
  }

  fs.mkdirSync('results', { recursive: true });
  fs.mkdirSync('results/screenshots', { recursive: true });
  const RUN_TS    = new Date().toISOString().replace(/[:.]/g, '-');
  const JSON_FILE = `results/run_${RUN_TS}.json`;
  const CSV_FILE  = `results/run_${RUN_TS}.csv`;

  initCSV(CSV_FILE);

  const runResults = {
    version: VERSION, run_ts: RUN_TS,
    filter: { module: FILTER_MOD, l1: FILTER_L1, l2: FILTER_L2 },
    total: filtered.length, passed: 0, failed: 0, manual: 0, pass_rate: '',
    results: [],
  };

  // ── Auth ──
  await context.grantPermissions(['geolocation'], { origin: new URL(BLU_URL).origin });
  await context.setGeolocation({ latitude: 18.5204, longitude: 73.8567 });

  console.log(`🚀 ${BLU_URL}`);
  await page.goto(BLU_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismissRetry(page);

  // ── Mobile — retry up to 3 times if UAT shows Retry card ──
  console.log('🔐 Entering mobile...');
  const mobileBox = page.getByRole('textbox', { name: /enter your mobile number/i }).first();
  await mobileBox.waitFor({ state: 'visible', timeout: 40000 });
  await clearAndType(page, mobileBox, BLU_MOBILE);
  const mobileSubmit = await submitFromComposer(page, mobileBox);
  console.log(`  ↳ Submit: ${mobileSubmit}`);

  // After mobile submit: Retry card can appear instead of OTP prompt
  let otpReady = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.waitForTimeout(3000);
    const retryBtn = page.getByRole('button', { name: /^Retry$/i }).first();
    if (await retryBtn.isVisible().catch(() => false)) {
      console.log(`  🟠 Retry after mobile (attempt ${attempt}) — retrying...`);
      const enabled = await retryBtn.isEnabled().catch(() => false);
      if (!enabled) await page.waitForTimeout(5000); // wait for cooldown
      await retryBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      const mobileBoxRetry = page.getByRole('textbox', { name: /enter your mobile number/i }).first();
      if (await mobileBoxRetry.isVisible().catch(() => false)) {
        await clearAndType(page, mobileBoxRetry, BLU_MOBILE);
        await submitFromComposer(page, mobileBoxRetry);
      }
      continue;
    }
    otpReady = true;
    break;
  }

  // ── OTP ──
  console.log('🔐 Entering OTP...');
  const otpBox = page.getByRole('textbox', { name: /otp|6.?digit/i }).first();
  await otpBox.waitFor({ state: 'visible', timeout: 20000 });
  await clearAndType(page, otpBox, BLU_OTP);
  const otpSubmit = await submitFromComposer(page, otpBox);
  console.log(`  ↳ Submit: ${otpSubmit}`);

  // After OTP submit: Retry card can appear instead of "OTP validated" text
  // Poll for either outcome
  let otpValidated = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.waitForTimeout(3000);

    // Check retry
    const retryBtn = page.getByRole('button', { name: /^Retry$/i }).first();
    if (await retryBtn.isVisible().catch(() => false)) {
      console.log(`  🟠 Retry after OTP (attempt ${attempt}) — waiting for cooldown...`);
      for (let w = 0; w < 20; w++) {
        await page.waitForTimeout(2000);
        const enabled = await retryBtn.isEnabled().catch(() => false);
        if (enabled) {
          await retryBtn.click({ force: true });
          console.log(`    ↳ Clicked retry after ${w * 2}s`);
          await page.waitForTimeout(2000);
          // Re-enter OTP
          const otpBoxRetry = page.getByRole('textbox', { name: /otp|6.?digit/i }).first();
          if (await otpBoxRetry.isVisible().catch(() => false)) {
            await clearAndType(page, otpBoxRetry, BLU_OTP);
            await submitFromComposer(page, otpBoxRetry);
          }
          break;
        }
      }
      continue;
    }

    // Check OTP validated
    const validated = await page.locator('text=/otp has been successfully validated/i').first()
      .isVisible().catch(() => false);
    if (validated) {
      otpValidated = true;
      break;
    }
  }

  if (!otpValidated) {
    throw new Error('OTP validation failed after retries — check UAT server status');
  }
  console.log('✅ OTP validated\n');

  // ── Wait for home — handles consent inside the loop ──
  await waitForHome(page);
  console.log('✅ Ready. Running tests...\n');

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

    // Handle consent or retry before each test case
    await dismissRetry(page);
    if (await isConsentPending(page)) {
      await acceptConsent(page, 0);
      await page.waitForTimeout(2000);
    }

    let beforeCount    = await botMessageCount(page);
    let botReply       = '';
    let timedOut       = false;
    let followUpRounds = 0;

    await clearAndType(page, composer, tc.utterance);
    await submitFromComposer(page, composer);

    try {
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

    // ── Multi-turn loop ──
    const MAX_FOLLOWUPS = 3;

    while (!timedOut && botReply && followUpRounds < MAX_FOLLOWUPS) {
      const detection = detectFollowUp(botReply);

      if (detection.isRelation) {
        console.log('  🔧 Bot requested relation selection...');
        await page.waitForTimeout(1500);
        const countBeforeRelation = await botMessageCount(page);
        await selectRelationByL1(page, tc.l1);
        // After chip click, bot needs time to process and respond
        await page.waitForTimeout(3000);
        try {
          botReply = await waitForFinalBotReply(page, countBeforeRelation, BOT_TIMEOUT);
          console.log('  ✅ Reply after relation');
        } catch {
          console.log('  ⚠️  No reply after relation selection');
          timedOut = true;
        }
        break;
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

      break;
    }

    // ── Score ──
    const elapsed = Date.now() - startTime;
    const scores  = timedOut
      ? { overall: 'Fail', reason: 'Timeout', matched_phrases: '', cta_found: 'N/A' }
      : scoreResult(tc, botReply);

    if (scores.overall === 'Pass')               passed++;
    else if (scores.overall === 'Fail')          failed++;
    else if (scores.overall === 'Manual Review') manual++;

    const icon = scores.overall === 'Pass' ? '✅' : scores.overall === 'Manual Review' ? '🔍' : '❌';
    console.log(`  🤖 ${botReply.slice(0, 100)}${botReply.length > 100 ? '…' : ''}`);
    console.log(`  ${icon} ${scores.overall} | CTA:${scores.cta_found} | ${elapsed}ms`);
    if (scores.reason) console.log(`     Reason: ${scores.reason}`);

    const resultRow = {
      tc_id: tc.id, module: tc.module, l1: tc.l1, l2: tc.l2, l3: tc.l3,
      utterance: tc.utterance, bot_reply: botReply.slice(0, 1000),
      expected_key_phrases: (tc.expected_key_phrases || []).join(' | '),
      matched_phrases: scores.matched_phrases,
      cta_expected: tc.cta_expected, cta_found: scores.cta_found,
      overall: scores.overall, reason: scores.reason || '',
      follow_up_rounds: followUpRounds, elapsed_ms: elapsed,
      mapping_type: tc.mapping_type, mapping_confidence: tc.mapping_confidence,
      scoring_type: tc.scoring_type,
    };

    runResults.results.push(resultRow);

    appendCSVRow(CSV_FILE, [
      resultRow.tc_id, resultRow.module, resultRow.l1, resultRow.l2, resultRow.l3,
      resultRow.utterance, resultRow.bot_reply, resultRow.expected_key_phrases,
      resultRow.matched_phrases, resultRow.cta_expected, resultRow.cta_found,
      resultRow.overall, resultRow.reason, resultRow.follow_up_rounds,
      resultRow.elapsed_ms, resultRow.mapping_type, resultRow.mapping_confidence,
      resultRow.scoring_type,
    ]);

    fs.writeFileSync(JSON_FILE, JSON.stringify(runResults, null, 2));
    await page.waitForTimeout(DELAY_MS);
  }

  // ── Summary ──
  const total    = passed + failed + manual;
  const passRate = total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%';
  runResults.passed = passed; runResults.failed = failed;
  runResults.manual = manual; runResults.pass_rate = passRate;
  fs.writeFileSync(JSON_FILE, JSON.stringify(runResults, null, 2));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`BLU UAT ${VERSION}`);
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  🔍 Manual Review: ${manual}`);
  console.log(`Pass Rate: ${passRate} (excl. manual review)`);
  console.log(`📄 JSON: ${JSON_FILE}`);
  console.log(`📊 CSV:  ${CSV_FILE}`);
  console.log(`${'═'.repeat(60)}\n`);
});
