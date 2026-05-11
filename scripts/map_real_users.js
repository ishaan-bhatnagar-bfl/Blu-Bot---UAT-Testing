#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CSV_PATH = 'data/3IN1 CHAT DATA DUMP.csv';
const JSON_DIR = 'JSON(s)/May 07 - Latest Content';
const OUTPUT_JSON = 'data/real_user_test_cases.json';
const REPORT_FILE = 'data/mapping_report.txt';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'should', 'could', 'may', 'might', 'can', 'must', 'you',
  'your', 'we', 'our', 'i', 'my', 'me', 'this', 'that', 'these', 'those',
  'ka', 'ki', 'hai', 'ho', 'mera', 'meri', 'kya', 'kaise', 'chahiye'
]);

function extractKeywords(text) {
  if (!text) return [];
  
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  
  return [...new Set(clean)];
}

function loadJSONs() {
  console.log(`📂 Loading JSONs from ${JSON_DIR}...`);
  
  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  const allEntries = [];
  
  files.forEach(file => {
    const content = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
    content.forEach(entry => {
      if (entry['chatbot-flag'] === 'yes') {
        allEntries.push({
          l1: entry.l1category,
          l2: entry.l2category,
          l3: entry.l3category,
          question: entry.question,
          answer: entry.answer,
          keywords: extractKeywords(entry.question + ' ' + entry.answer)
        });
      }
    });
  });
  
  console.log(`   Loaded ${allEntries.length} JSON entries`);
  return allEntries;
}

function mapQueryToJSON(query, jsons) {
  const queryKw = extractKeywords(query);
  
  if (queryKw.length === 0) {
    return { json: null, confidence: 0, reason: 'No keywords extracted' };
  }
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const json of jsons) {
    const overlap = queryKw.filter(kw => json.keywords.includes(kw)).length;
    const score = overlap / Math.max(queryKw.length, json.keywords.length);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = json;
    }
  }
  
  const confidence = Math.round(bestScore * 100);
  
  if (confidence < 20) {
    return { json: bestMatch, confidence, reason: 'Low keyword overlap' };
  }
  
  return { json: bestMatch, confidence, reason: 'OK' };
}

function detectCTA(answer) {
  const ctaPatterns = [
    /click here/i, /tap here/i, /apply (for|now)/i, /start.*application/i,
    /raise a request/i, /visit.*page/i, /document center/i, /access and manage/i
  ];
  
  return ctaPatterns.some(p => p.test(answer)) ? 'Yes' : 'No';
}

function extractAnswerKeywords(answer) {
  const words = extractKeywords(answer);
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w)
    .join('|');
}

async function main() {
  console.log('🔧 BLU Real User Query Mapper\n');
  console.log(`📊 Processing ${CSV_PATH}...`);
  
  const jsons = loadJSONs();
  
  console.log('\n📖 Reading CSV...');
  
  const queries = [];
  const seen = new Set();
  let totalRows = 0;
  let duplicates = 0;
  
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, 'utf8')
      .pipe(csv())
      .on('data', (row) => {
        totalRows++;
        
        // Debug first 3 rows
        if (totalRows <= 3) {
          console.log(`   Row ${totalRows} keys:`, Object.keys(row));
          console.log(`   Row ${totalRows} data:`, row);
        }
        
        // Try both 'question' and column 0
        const query = (row.question || row['﻿question'] || row._0 || '').trim();
        
        if (!query || query.length < 3) return;
        
        if (seen.has(query)) {
          duplicates++;
          return;
        }
        
        seen.add(query);
        queries.push(query);
        
        if (totalRows % 10000 === 0) {
          process.stdout.write(`\r   Processed: ${totalRows.toLocaleString()} rows...`);
        }
      })
      .on('end', () => {
        console.log(`\r   Total rows: ${totalRows.toLocaleString()}`);
        console.log(`   Duplicates removed: ${duplicates.toLocaleString()}`);
        console.log(`   Unique queries: ${queries.length.toLocaleString()}\n`);
        resolve();
      })
      .on('error', (err) => {
        console.error('CSV Error:', err.message);
        reject(err);
      });
  });
  
  console.log('🗺️  Mapping to JSONs...');
  
  const testCases = [];
  const report = {
    high: [],
    medium: [],
    low: []
  };
  
  queries.forEach((query, idx) => {
    const { json, confidence, reason } = mapQueryToJSON(query, jsons);
    
    if (!json) {
      report.low.push({ query, confidence: 0, reason: 'No match found' });
      return;
    }
    
    const tc = {
      id: `TC_REAL_${String(idx + 1).padStart(5, '0')}`,
      variation_type: 'Real User',
      source: '3IN1 CHAT DATA DUMP',
      utterance: query,
      l1: json.l1,
      l2: json.l2,
      l3: json.l3,
      data_state: 'generic',
      expected_answer: json.answer,
      expected_keywords: extractAnswerKeywords(json.answer),
      cta_expected: detectCTA(json.answer),
      mapping_confidence: confidence,
      matched_question: json.question
    };
    
    testCases.push(tc);
    
    if (confidence >= 60) {
      report.high.push({ query, l1: json.l1, confidence });
    } else if (confidence >= 40) {
      report.medium.push({ query, l1: json.l1, confidence });
    } else {
      report.low.push({ query, l1: json.l1, confidence, reason });
    }
    
    if ((idx + 1) % 5000 === 0) {
      process.stdout.write(`\r   Mapped: ${(idx + 1).toLocaleString()}/${queries.length.toLocaleString()} (${Math.round(((idx + 1) / queries.length) * 100)}%)`);
    }
  });
  
  console.log(`\r   Mapped: ${testCases.length.toLocaleString()}/${queries.length.toLocaleString()} (100%)\n`);
  
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(testCases, null, 2));
  console.log(`💾 Saved: ${OUTPUT_JSON}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT_JSON).size / 1024 / 1024).toFixed(2)} MB\n`);
  
  const reportLines = [
    '=== BLU REAL USER MAPPING REPORT ===\n',
    `Total queries processed: ${queries.length.toLocaleString()}`,
    `Test cases generated: ${testCases.length.toLocaleString()}\n`,
    
    `High confidence (≥60%): ${report.high.length.toLocaleString()} (${Math.round((report.high.length / testCases.length) * 100)}%)`,
    `Medium confidence (40-59%): ${report.medium.length.toLocaleString()} (${Math.round((report.medium.length / testCases.length) * 100)}%)`,
    `Low confidence (<40%): ${report.low.length.toLocaleString()} (${Math.round((report.low.length / testCases.length) * 100)}%)\n`,
    
    '\n=== L1 DISTRIBUTION ===\n'
  ];
  
  const l1Counts = {};
  testCases.forEach(tc => {
    l1Counts[tc.l1] = (l1Counts[tc.l1] || 0) + 1;
  });
  
  Object.entries(l1Counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([l1, count]) => {
      reportLines.push(`${l1.padEnd(25)} ${count.toLocaleString().padStart(8)} (${Math.round((count / testCases.length) * 100)}%)`);
    });
  
  reportLines.push('\n\n=== LOW CONFIDENCE SAMPLES (REVIEW NEEDED) ===\n');
  
  report.low.slice(0, 50).forEach(item => {
    reportLines.push(`Query: "${item.query}"`);
    reportLines.push(`  L1: ${item.l1 || 'Unknown'}`);
    reportLines.push(`  Confidence: ${item.confidence}%`);
    reportLines.push(`  Reason: ${item.reason}`);
    reportLines.push('');
  });
  
  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'));
  console.log(`📄 Report: ${REPORT_FILE}\n`);
  
  console.log('✅ Mapping complete!\n');
  console.log('📊 Summary:');
  console.log(`   High confidence: ${report.high.length.toLocaleString()} (${Math.round((report.high.length / testCases.length) * 100)}%)`);
  console.log(`   Medium confidence: ${report.medium.length.toLocaleString()} (${Math.round((report.medium.length / testCases.length) * 100)}%)`);
  console.log(`   Low confidence: ${report.low.length.toLocaleString()} (${Math.round((report.low.length / testCases.length) * 100)}%)\n`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
