'use strict';
/**
 * BLU UAT v2.0 - COMPLETE FIX
 * 
 * Version: 2.0
 * Date: 2026-05-08
 * 
 * Fixes:
 * 1. Version control in output
 * 2. Complete multi-turn before next test
 * 3. Direct loan selection (skip Level 1)
 * 4. Extended follow-up patterns
 * 5. Proper message wait after relation
 */

const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const VERSION = 'v2.0';

const cfg = JSON.parse(fs.readFileSync(path.resolve('run_config.json'), 'utf-8'));
const allCases = JSON.parse(fs.readFileSync(path.resolve('data/blu_test_cases.json'), 'utf-8'));

const THINKING_PHRASES = [
  'checking', 'hold on', 'kindly wait', 'just a moment',
  'working on it', 'confirming', 'please wait', 'one moment',
  'fetching', 'loading', 'processing',
];

function isThinkingState(text) {
  const lower = text.toLowerCase().trim();
  return THINKING_PHRASES.some(p => lower.includes(p)) && lower.length < 60;
}

function needsFollowUp(botReply) {
  const followUpPatterns = [
    // Amount/rate/tenure
    /you('ll| will) need/i,
    /please provide.*details/i,
    /provide.*loan amount/i,
    /provide.*interest rate/i,
    /provide.*tenure/i,
    /loan amount.*tenure.*interest/i,
    
    // Product type
    /specify.*loan product/i,
    /specify.*product/i,
    /which.*loan.*interested/i,
    /which.*product/i,
    /personal loan.*home loan/i,
    /loan product specify/i,
    
    // Loan variant (NEW)
    /select.*variant/i,
    /choose.*variant/i,
    /flexi hybrid.*flexi term/i,
    /personal loan variant/i,
    /chosen personal loan variant/i,
  ];
  
  return followUpPatterns.some(p => p.test(botReply));
}

function generateFollowUpData(botReply) {
  const lower = botReply.toLowerCase();
  
  // Loan variant question
  if (lower.includes('variant')) {
    if (lower.includes('flexi') || lower.includes('hybrid') || lower.includes('term')) {
      return 'Flexi Hybrid Term Loan';
    }
  }
  
  // Product type question
  if (lower.includes('specify') || lower.includes('which')) {
    if (lower.includes('product') || lower.includes('loan')) {
      return 'Personal Loan';
    }
  }
  
  // Amount/rate/tenure question
  if (lower.includes('you') && lower.includes('need')) {
    return 'Loan amount 5 lakh, interest rate 12%, tenure 3 years';
  }
  
  if (lower.includes('loan amount') || lower.includes('interest') || lower.includes('tenure')) {
    return 'Loan amount 5 lakh, interest rate 12%, tenure 3 years';
  }
  
  return null;
}

async function screenshot(page, label) {
  const p = `results/screenshots/${label}_${Date.now()}.png`;
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  console.log(`  📸 ${p}`);
  return p;
}

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
      const rb = parent.querySelector('[role="button"]');
      if (rb) { rb.click(); return 'role-button'; }
      for (const img of parent.querySelectorAll('img')) {
        if (window.getComputedStyle(img).cursor === 'pointer') {
          img.click(); return 'img-pointer';
        }
      }
      const imgs = parent.querySelectorAll('img');
      if (imgs.length) { imgs[imgs.length - 1].click(); return 'img-last'; }
      node = parent;
    }
    return null;
  }).catch(() => null);
  if (!method) { await locator.press('Enter').catch(() => {}); return 'enter'; }
  return method;
}

async function dismissRetry(page) {
  const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  let attempts = 0;
  while (await btn.isVisible().catch(() => false) && attempts < 5) {
    await btn.click({ force: true });
    await page.waitForTimeout(2000);
    attempts++;
  }
}

async function isConsentPending(page) {
  return await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    return checkboxes.some(cb => !cb.checked);
  }).catch(() => false);
}

async function acceptConsent(page, attempt) {
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
  await Promise.race([
    page.locator('input[type="checkbox"]').first()
      .waitFor({ state: 'attached', timeout: 15000 }),
    page.locator('text=What you can do next').first()
      .waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {});

  for (let i = 1; i <= 20; i++) {
    await dismissRetry(page);
    if (await isInitialHomeReady(page)) {
      console.log(`  ✅ Home ready (${i})`);
      return;
    }
    if (await isConsentPending(page)) {
      await acceptConsent(page, i);
    } else {
      await page.waitForTimeout(1000);
    }
  }

  await screenshot(page, 'fail_home_not_reached');
  throw new Error('Home not reached');
}

async function selectRelationChip(page, targetText) {
  console.log(`    🔧 Chip: "${targetText}"...`);
  
  await page.waitForTimeout(2000);
  
  const clicked = await page.evaluate((target) => {
    const allDivs = Array.from(document.querySelectorAll('div, button'));
    
    for (const el of allDivs) {
      const text = el.innerText || '';
      const isClickable = window.getComputedStyle(el).cursor === 'pointer' || 
                          el.tagName === 'BUTTON' ||
                          el.onclick;
      
      if (!isClickable) continue;
      
      // Exact match
      if (text.trim() === target) {
        el.click();
        return text.trim();
      }
      
      // AUTO = pick first loan card
      if (target === 'AUTO') {
        if (text.includes('Active') || 
            text.includes('Closed') ||
            text.includes('PERSONAL') || 
            text.includes('LOAN') ||
            text.includes('Disbursal')) {
          el.click();
          return text.trim().slice(0, 30);
        }
      }
    }
    return null;
  }, targetText).catch(() => null);
  
  if (clicked) {
    console.log(`      ✓ "${clicked}"`);
    await page.waitForTimeout(5000); // EXTENDED wait
    await dismissRetry(page);
    return true;
  } else {
    console.log(`      ✗ Not found`);
    return false;
  }
}

async function selectRelationByL1(page, l1Category) {
  console.log(`  🔧 Relation for L1: ${l1Category}`);
  
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  
  const needsRelation = bodyText.includes('Please select the relation') ||
                       bodyText.includes('select the product to move further');
  
  if (!needsRelation) {
    console.log('    ↳ Not needed');
    return false;
  }
  
  // Check if bot is showing loan cards directly (skip Level 1)
  const showingLoanCards = bodyText.includes('Active') && 
                          bodyText.includes('PERSONAL LOAN') &&
                          bodyText.includes('Disbursal');
  
  if (showingLoanCards) {
    console.log('    ↳ Direct loan cards shown, selecting first...');
    await selectRelationChip(page, 'AUTO');
    return true;
  }
  
  // Level 1: Product type
  const l1Lower = l1Category.toLowerCase();
  let level1Chip = null;
  
  if (l1Lower.includes('loan')) level1Chip = 'Loan';
  else if (l1Lower.includes('card')) level1Chip = 'Cards';
  else if (l1Lower.includes('insurance')) level1Chip = 'Insurance';
  else if (l1Lower.includes('investment') || l1Lower.includes('deposit')) level1Chip = 'Investment';
  
  if (!level1Chip) {
    console.log('    ↳ Unknown L1');
    return false;
  }
  
  const clicked1 = await selectRelationChip(page, level1Chip);
  if (!clicked1) return false;
  
  // Level 2: Check for specific loan instance
  await page.waitForTimeout(3000);
  
  const bodyText2 = await page.evaluate(() => document.body.innerText).catch(() => '');
  const needsLevel2 = bodyText2.includes('Active') || 
                     bodyText2.includes('Closed') || 
                     bodyText2.includes('PERSONAL LOAN');
  
  if (needsLevel2) {
    console.log('    🔧 Level 2: specific loan...');
    await selectRelationChip(page, 'AUTO');
  }
  
  return true;
}

async function botMessageCount(page) {
  return page.locator('.blu-bot-message.message').count().catch(() => 0);
}

async function waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT) {
  const deadline = Date.now() + BOT_TIMEOUT;

  await expect.poll(() => botMessageCount(page), {
    timeout: BOT_TIMEOUT,
    intervals: [300, 500, 800, 1000],
  }).toBeGreaterThan(beforeCount);

  let lastText = '';
  let stableCount = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);

    const last    = page.locator('.blu-bot-message.message').last();
    const current = (await last.innerText().catch(() => '')).trim();

    if (!current) {
      stableCount = 0;
      lastText = current;
      continue;
    }

    if (isThinkingState(current)) {
      console.log(`    ⏳ "${current}"`);
      stableCount = 0;
      lastText = current;
      continue;
    }

    if (current === lastText) {
      stableCount++;
      if (stableCount >= 2) {
        return current;
      }
    } else {
      stableCount = 1;
      lastText = current;
    }
  }

  return lastText;
}

function scoreResult(tc, botReply) {
  const reply     = botReply.toLowerCase();
  const keywords  = (tc.expected_keywords || '').split('|').map(k => k.trim().toLowerCase()).filter(Boolean);
  const matchedKw = keywords.filter(k => reply.includes(k));
  const responseMatch = keywords.length === 0 ? 'Pass' :
    (matchedKw.length >= Math.ceil(keywords.length * 0.4) ? 'Pass' : 'Fail');

  let ctaPresent = 'N/A';
  if (tc.cta_expected === 'Yes') {
    const hasAnyCTA = 
      reply.includes('click') || reply.includes('tap') || 
      reply.includes('apply') || reply.includes('visit') ||
      reply.includes('document center') || reply.includes('access') ||
      reply.includes('start') || reply.includes('raise');
    
    ctaPresent = hasAnyCTA ? 'Pass' : 'Fail';
  }

  let ctaTypeCorrect = 'N/A';
  if (tc.cta_expected === 'Yes' && tc.cta_type) {
    ctaTypeCorrect = ctaPresent === 'Pass' ? 'Pass' : 'Fail';
  }

  const checks  = [responseMatch, ctaPresent, ctaTypeCorrect].filter(v => v !== 'N/A');
  const overall = checks.every(v => v === 'Pass') ? 'Pass' : 'Fail';
  return { responseMatch, ctaPresent, ctaTypeCorrect, overall, matchedKw: matchedKw.join(', ') };
}

test('BLU UAT', async ({ page, context }) => {
  const BLU_URL     = process.env.BLU_URL         || cfg.BLU_URL;
  const BLU_MOBILE  = process.env.BLU_MOBILE      || cfg.BLU_MOBILE;
  const BLU_OTP     = process.env.BLU_OTP         || cfg.BLU_OTP;
  const BATCH_SIZE  = parseInt(process.env.BATCH_SIZE      || cfg.BATCH_SIZE);
  const FILTER_L1   = process.env.FILTER_L1       || cfg.FILTER_L1        || '';
  const FILTER_VAR  = process.env.FILTER_VARIATION || cfg.FILTER_VARIATION || '';
  const DELAY_MS    = parseInt(process.env.DELAY_MS || cfg.DELAY_BETWEEN_MSGS_MS);
  const BOT_TIMEOUT = parseInt(cfg.BOT_REPLY_TIMEOUT_MS);

  let filtered = allCases;
  
  if (FILTER_L1) {
    filtered = filtered.filter(tc => tc.l1.toLowerCase() === FILTER_L1.toLowerCase());
  }
  
  if (FILTER_VAR) {
    filtered = filtered.filter(tc => tc.variation_type === FILTER_VAR);
  }
  
  filtered = filtered.slice(0, BATCH_SIZE);
  
  console.log(`\n🔧 BLU UAT ${VERSION}`);
  console.log(`📋 ${filtered.length} test cases\n`);
  
  if (filtered.length === 0) return;

  fs.mkdirSync('results', { recursive: true });
  fs.mkdirSync('results/screenshots', { recursive: true });
  const RUN_TS       = new Date().toISOString().replace(/[:.]/g, '-');
  const RESULTS_FILE = `results/run_${RUN_TS}.json`;
  
  const runResults = { 
    version: VERSION,
    run_ts: RUN_TS, 
    total: filtered.length, 
    results: [] 
  };

  await context.grantPermissions(['geolocation'], { origin: new URL(BLU_URL).origin });
  await context.setGeolocation({ latitude: 18.5204, longitude: 73.8567 });

  console.log(`🚀 ${BLU_URL}`);
  await page.goto(BLU_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismissRetry(page);

  console.log('🔐 Mobile...');
  const mobileBox = page.getByRole('textbox', { name: /enter your mobile number/i }).first();
  await mobileBox.waitFor({ state: 'visible', timeout: 40000 });
  await clearAndType(page, mobileBox, BLU_MOBILE);
  await submitFromComposer(page, mobileBox);

  await page.waitForTimeout(3000);
  
  console.log('🔐 OTP...');
  const otpBox = page.getByRole('textbox', { name: /otp|6.?digit/i }).first();
  await otpBox.waitFor({ state: 'visible', timeout: 20000 });
  await clearAndType(page, otpBox, BLU_OTP);
  await submitFromComposer(page, otpBox);

  await page.locator('text=/otp has been successfully validated/i').first()
    .waitFor({ state: 'visible', timeout: 35000 });
  console.log('✅ Validated\n');

  await waitForHome(page);

  if (filtered.length > 0) {
    await selectRelationByL1(page, filtered[0].l1);
  }

  const composer = page.locator('textarea, [contenteditable="true"]').first();
  await composer.waitFor({ state: 'visible', timeout: 30000 });
  console.log(`✅ Running ${filtered.length} tests\n`);

  let passed = 0, failed = 0;

  for (let i = 0; i < filtered.length; i++) {
    const tc = filtered[i];
    console.log(`\n[${i + 1}/${filtered.length}] ${tc.id} ${tc.variation_type}`);
    console.log(`  💬 "${tc.utterance}"`);

    await dismissRetry(page);
    if (await isConsentPending(page)) {
      await acceptConsent(page, 1);
    }

    let beforeCount = await botMessageCount(page);
    const startTime = Date.now();

    await clearAndType(page, composer, tc.utterance);
    await submitFromComposer(page, composer);

    let botReply = '';
    let timedOut = false;
    
    try {
      botReply = await waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT);
    } catch {
      timedOut = true;
      await screenshot(page, `timeout_${tc.id}`);
    }

    // RECURSIVE MULTI-TURN - complete all follow-ups before scoring
    let followUpCount = 0;
    while (!timedOut && botReply && needsFollowUp(botReply) && followUpCount < 3) {
      followUpCount++;
      console.log(`  🔄 Follow-up ${followUpCount}`);
      
      const followUpData = generateFollowUpData(botReply);
      if (!followUpData) {
        console.log('    ⚠️  No pattern match');
        break;
      }
      
      console.log(`    📝 "${followUpData}"`);
      await page.waitForTimeout(2000);
      beforeCount = await botMessageCount(page);
      
      await clearAndType(page, composer, followUpData);
      await submitFromComposer(page, composer);
      
      try {
        botReply = await waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT);
        console.log('    ✅ Response received');
      } catch {
        console.log('    ⚠️  Timeout');
        timedOut = true;
        break;
      }
    }

    // RELATION SELECTION - only after multi-turn complete
    if (!timedOut && botReply) {
      const needsRelation = botReply.toLowerCase().includes('select the relation') ||
                           botReply.toLowerCase().includes('select the product');
      if (needsRelation) {
        console.log('  🔧 Relation requested');
        await selectRelationByL1(page, tc.l1);
        
        // CRITICAL: Get FRESH message count after selection
        await page.waitForTimeout(5000);
        beforeCount = await botMessageCount(page);
        
        try {
          botReply = await waitForFinalBotReply(page, beforeCount, BOT_TIMEOUT);
          console.log('  ✅ Final answer received');
        } catch {
          console.log('  ⚠️  No reply after relation');
          timedOut = true;
        }
      }
    }

    const elapsed = Date.now() - startTime;
    const scores  = timedOut
      ? { responseMatch: 'Fail', ctaPresent: 'N/A', ctaTypeCorrect: 'N/A', overall: 'Fail', matchedKw: '' }
      : scoreResult(tc, botReply);

    if (scores.overall === 'Pass') passed++; else failed++;
    const icon = scores.overall === 'Pass' ? '✅' : '❌';
    console.log(`  🤖 ${botReply.slice(0, 100)}${botReply.length > 100 ? '…' : ''}`);
    console.log(`  ${icon} ${scores.overall} | R:${scores.responseMatch} | CTA:${scores.ctaPresent}`);

    runResults.results.push({
      tc_id:          tc.id,
      utterance:      tc.utterance,
      bot_reply:      botReply.slice(0, 500),
      follow_ups:     followUpCount,
      elapsed_ms:     elapsed,
      overall:        scores.overall,
    });

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(runResults, null, 2));
    
    // DON'T move to next test until current one is complete
    await page.waitForTimeout(DELAY_MS);
  }

  runResults.passed    = passed;
  runResults.failed    = failed;
  runResults.pass_rate = `${((passed / filtered.length) * 100).toFixed(1)}%`;
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(runResults, null, 2));

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`BLU UAT ${VERSION}`);
  console.log(`✅ ${passed}  ❌ ${failed}  Rate: ${runResults.pass_rate}`);
  console.log(`📄 ${RESULTS_FILE}`);
  console.log(`${'═'.repeat(50)}\n`);
});
