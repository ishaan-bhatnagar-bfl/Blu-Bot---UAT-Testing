#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REAL_USER_JSON = 'data/real_user_test_cases.json';
const JSON_DIR = 'JSON(s)/May 07 - Latest Content';
const OUTPUT_JSON = 'data/blu_test_cases_v3.json';

function extractKeywords(answer) {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'can', 'must', 'you',
    'your', 'we', 'our', 'i', 'my', 'me', 'this', 'that', 'these', 'those'
  ]);
  
  const words = answer
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w)
    .join('|');
}

function detectCTA(answer) {
  const patterns = [
    /click here/i, /tap here/i, /apply (for|now)/i, /start.*application/i,
    /raise a request/i, /visit.*page/i, /document center/i
  ];
  
  return patterns.some(p => p.test(answer)) ? 'Yes' : 'No';
}

function detectMultiTurn(answer) {
  const patterns = [
    /please provide.*details/i,
    /provide.*loan amount/i,
    /specify.*product/i,
    /which.*loan/i
  ];
  
  return patterns.some(p => p.test(answer));
}

console.log('🔧 BLU Test Case Generator v3.0\n');

console.log('📋 Loading real user test cases...');
const realUserCases = JSON.parse(fs.readFileSync(REAL_USER_JSON, 'utf-8'));
console.log(`   Loaded: ${realUserCases.length.toLocaleString()} real user queries\n`);

console.log('📋 Loading JSONs for gap-fill...');
const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
const allQA = [];

files.forEach(file => {
  const content = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
  content.forEach(entry => {
    if (entry['chatbot-flag'] === 'yes') {
      allQA.push({
        l1: entry.l1category,
        l2: entry.l2category,
        l3: entry.l3category,
        question: entry.question,
        answer: entry.answer
      });
    }
  });
});

console.log(`   Loaded: ${allQA.length.toLocaleString()} JSON Q&A pairs\n`);

console.log('🔍 Finding coverage gaps...');
const realCoverage = new Set();
realUserCases.forEach(tc => {
  realCoverage.add(`${tc.l1}::${tc.l2}::${tc.l3}`);
});

const syntheticCases = [];
let tcID = realUserCases.length + 1;

allQA.forEach(qa => {
  const key = `${qa.l1}::${qa.l2}::${qa.l3}`;
  
  if (realCoverage.has(key)) return;
  
  syntheticCases.push({
    id: `TC_SYNTH_${String(tcID).padStart(5, '0')}`,
    variation_type: 'Synthetic',
    l1: qa.l1,
    l2: qa.l2,
    l3: qa.l3,
    data_state: 'generic',
    is_multi_turn: detectMultiTurn(qa.answer),
    utterance: qa.question,
    expected_answer: qa.answer,
    expected_keywords: extractKeywords(qa.answer),
    cta_expected: detectCTA(qa.answer),
    cta_type: detectCTA(qa.answer) === 'Yes' ? 'button' : '',
    cta_label: ''
  });
  
  tcID++;
  realCoverage.add(key);
});

console.log(`   Gap-fill synthetic: ${syntheticCases.length.toLocaleString()} test cases\n`);

const combined = [...realUserCases, ...syntheticCases];

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(combined, null, 2));

console.log(`💾 Saved: ${OUTPUT_JSON}`);
console.log(`   File size: ${(fs.statSync(OUTPUT_JSON).size / 1024 / 1024).toFixed(2)} MB\n`);

const byType = {
  'Real User': realUserCases.length,
  'Synthetic': syntheticCases.length
};

const byL1 = {};
combined.forEach(tc => {
  byL1[tc.l1] = (byL1[tc.l1] || 0) + 1;
});

console.log('📊 Test case breakdown:');
Object.entries(byType).forEach(([type, count]) => {
  console.log(`   ${type.padEnd(15)} ${count.toLocaleString().padStart(8)} (${Math.round((count / combined.length) * 100)}%)`);
});

console.log('\n📊 L1 distribution:');
Object.entries(byL1)
  .sort((a, b) => b[1] - a[1])
  .forEach(([l1, count]) => {
    console.log(`   ${l1.padEnd(25)} ${count.toLocaleString().padStart(8)} (${Math.round((count / combined.length) * 100)}%)`);
  });

console.log('\n✅ Done!\n');
