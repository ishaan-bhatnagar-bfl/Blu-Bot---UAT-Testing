#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const JSON_DIR = 'JSON(s)/May 07 - Latest Content';
const OUTPUT_DIR = 'data';
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'blu_test_cases.json');

// ─── AUTHENTIC LANGUAGE PATTERNS ──────────────────────────────────────────────

function generateCasual(question) {
  let casual = question;
  
  // CRITICAL: Handle "top up" BEFORE other patterns to prevent breaking it
  if (/top.*up/i.test(casual)) {
    casual = casual.replace(/I want.*top.*up/i, 'Top up chahiye');
    casual = casual.replace(/want.*top.*up/i, 'Top up lena hai');
    return casual;
  }
  
  const patterns = [
    [/How do I calculate my EMI/i, 'Meri EMI kaise calculate karu'],
    [/How can I calculate my EMI/i, 'EMI calculate kaise hota hai'],
    [/How do I download/i, 'Download kaise karu'],
    [/How can I download/i, 'Kaise download karu'],
    [/How do I check/i, 'Kaise check karu'],
    [/How can I check/i, 'Check kaise hota hai'],
    [/How do I get/i, 'Kaise milega'],
    [/How can I get/i, 'Milega kaise'],
    [/How do I apply/i, 'Apply kaise karu'],
    [/How can I apply/i, 'Kaise apply karu'],
    [/What is my/i, 'Mera kya hai'],
    [/What should I do/i, 'Kya karna chahiye'],
    [/I want to know/i, 'Janna hai'],
    [/I want to/i, 'Karna hai'],
    [/Please tell me/i, 'Batao'],
    [/Can you tell me/i, 'Bata sakte ho'],
    [/my EMI/gi, 'meri EMI'],
    [/my loan/gi, 'mera loan'],
    [/my card/gi, 'mera card'],
    [/my account/gi, 'mera account'],
    [/my payment/gi, 'mera payment'],
  ];
  
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(casual)) {
      casual = casual.replace(pattern, replacement);
      break;
    }
  }
  
  casual = casual.replace(/\?$/, '');
  return casual;
}

function generateConcise(question) {
  let concise = question;
  
  // CRITICAL: Handle "top up" first
  if (/top.*up/i.test(concise)) {
    return 'Top up chahiye';
  }
  
  const patterns = [
    [/How do I calculate my EMI.*value/i, 'EMI calculate kaise'],
    [/calculate.*EMI/i, 'EMI kitna hoga'],
    [/How.*download.*KFS/i, 'KFS download karna hai'],
    [/download.*statement/i, 'Statement chahiye'],
    [/EMI not debited/i, 'EMI nahi kata'],
    [/payment.*not.*deducted/i, 'Payment nahi hua'],
    [/^How do I /i, ''],
    [/^How can I /i, ''],
    [/^What should I do if /i, ''],
    [/^I want to know /i, ''],
    [/^I want to /i, ''],
    [/^Can you tell me /i, ''],
    [/^Please /i, ''],
  ];
  
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(concise)) {
      concise = concise.replace(pattern, replacement);
      if (replacement) break;
    }
  }
  
  concise = concise.replace(/\?$/, '').trim();
  if (concise.length > 0) {
    concise = concise.charAt(0).toUpperCase() + concise.slice(1);
  }
  
  return concise;
}

function generateVerbose(question) {
  let verbose = question;
  
  const patterns = [
    [/How do I/i, 'I would like to know how I can'],
    [/How can I/i, 'Could you please guide me on how to'],
    [/What should I do/i, 'I need guidance on what to do'],
    [/I want to/i, 'I would like to'],
  ];
  
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(verbose)) {
      verbose = verbose.replace(pattern, replacement);
      break;
    }
  }
  
  if (!verbose.includes('please') && !verbose.includes('kindly')) {
    if (!verbose.endsWith('?')) {
      verbose += '. Please help';
    } else {
      verbose = verbose.replace('?', '. Please guide me');
    }
  }
  
  return verbose;
}

function detectMultiTurn(answer) {
  const followUpPatterns = [
    /please provide.*details/i,
    /need.*following.*information/i,
    /provide.*loan amount.*interest rate.*tenure/i,
    /provide.*loan amount/i,
    /provide.*interest rate/i,
    /provide.*tenure/i,
    /specify.*loan product/i,
    /which.*loan.*interested/i,
    /which.*product/i,
    /personal loan.*home loan/i,
  ];
  
  return followUpPatterns.some(p => p.test(answer));
}

function detectCTA(answer) {
  const ctaPatterns = [
    /click here/i,
    /tap here/i,
    /tap to/i,
    /click to/i,
    /apply (for|now)/i,
    /start.*application/i,
    /raise a request/i,
    /submit a request/i,
    /visit.*page/i,
    /document center/i,
    /access and manage/i,
    /get started/i,
    /contact.*at/i,
    /cta label:/i,
    /android cta link/i,
    /ios cta link/i,
  ];
  
  const hasCTA = ctaPatterns.some(p => p.test(answer));
  
  if (!hasCTA) {
    return { expected: 'No', type: '', label: '' };
  }
  
  let label = '';
  if (/click here|tap here/i.test(answer)) label = 'click here';
  else if (/raise a request/i.test(answer)) label = 'raise a request';
  else if (/apply (for|now)/i.test(answer)) label = 'apply';
  else if (/document center/i.test(answer)) label = 'document center';
  else if (/visit.*page/i.test(answer)) label = 'visit page';
  
  return {
    expected: 'Yes',
    type: 'button',
    label: label
  };
}

function extractKeywords(answer) {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'can', 'must', 'you',
    'your', 'we', 'our', 'i', 'my', 'me', 'this', 'that', 'these', 'those'
  ]);
  
  const cleanAnswer = answer.replace(/<[^>]+>/g, ' ');
  
  const words = cleanAnswer
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  
  return sorted.join('|');
}

function detectDataState(question, answer) {
  const relationalPatterns = [
    /your loan/i,
    /your card/i,
    /your account/i,
    /your emi/i,
    /your balance/i,
    /your statement/i,
    /your payment/i,
    /select.*relation/i,
    /please select/i,
    /active.*loan/i,
    /closed.*loan/i,
  ];
  
  if (relationalPatterns.some(p => p.test(answer))) {
    return 'relational';
  }
  
  return 'generic';
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

console.log('🔧 BLU Test Case Generator - FIXED\n');

console.log(`📂 Reading JSONs from: ${JSON_DIR}`);
const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
console.log(`   Found ${files.length} JSON files\n`);

let allQA = [];
let skipped = 0;

files.forEach((file, idx) => {
  const content = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
  
  content.forEach(entry => {
    if (entry['chatbot-flag'] !== 'yes') {
      skipped++;
      return;
    }
    
    allQA.push({
      l1: entry.l1category,
      l2: entry.l2category,
      l3: entry.l3category,
      question: entry.question,
      answer: entry.answer,
    });
  });
  
  if ((idx + 1) % 20 === 0) {
    console.log(`   Processed ${idx + 1}/${files.length} files...`);
  }
});

console.log(`\n✅ Loaded ${allQA.length} Q&A pairs (skipped ${skipped})\n`);
console.log('🔨 Generating test cases...');

const testCases = [];
let tcID = 1;
let multiTurnCount = 0;

allQA.forEach((qa, idx) => {
  const isMultiTurn = detectMultiTurn(qa.answer);
  if (isMultiTurn) multiTurnCount++;
  
  const variations = [
    { type: 'Casual', utterance: generateCasual(qa.question) },
    { type: 'Concise', utterance: generateConcise(qa.question) },
    { type: 'Verbose', utterance: generateVerbose(qa.question) },
  ];
  
  const keywords = extractKeywords(qa.answer);
  const cta = detectCTA(qa.answer);
  const dataState = detectDataState(qa.question, qa.answer);
  
  variations.forEach(v => {
    testCases.push({
      id: `TC_${String(tcID).padStart(5, '0')}`,
      variation_type: v.type,
      l1: qa.l1,
      l2: qa.l2,
      l3: qa.l3,
      data_state: dataState,
      is_multi_turn: isMultiTurn,
      utterance: v.utterance,
      expected_answer: qa.answer,
      expected_keywords: keywords,
      cta_expected: cta.expected,
      cta_type: cta.type,
      cta_label: cta.label,
    });
    tcID++;
  });
  
  if ((idx + 1) % 500 === 0) {
    console.log(`   Generated ${tcID - 1} test cases...`);
  }
});

console.log(`\n✅ Generated ${testCases.length} test cases`);
console.log(`   Multi-turn: ${multiTurnCount}\n`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(testCases, null, 2));

console.log(`💾 Saved: ${OUTPUT_JSON}`);
console.log(`   Size: ${(fs.statSync(OUTPUT_JSON).size / 1024 / 1024).toFixed(2)} MB\n`);

console.log('✅ Done!\n');
