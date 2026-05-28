const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const JSON_DIR  = 'JSON(s)/May 07 - Latest Content';
const LOAN_REPO = 'data/Loan Knowledge Repository version-1.1.xlsx';
const INS_REPO  = 'data/Insurance Knowledge Repository version 1.1 1.xlsx';

// Load JSONs
const jsonEntries = [];
fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json')).forEach(file => {
  const content = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
  content.forEach(e => {
    if (e.question) jsonEntries.push({
      l1: e.l1category, l2: e.l2category, l3: e.l3category,
      question: e.question.trim().toLowerCase(),
      flag: (e['chatbot-flag'] || '').toLowerCase().trim(),
      source: 'json'
    });
  });
});

// Load Loan repo
const loanWb = XLSX.readFile(LOAN_REPO);
const loanRows = XLSX.utils.sheet_to_json(loanWb.Sheets[loanWb.SheetNames[0]], { header: 1 }).slice(1);
const loanEntries = loanRows.map(r => ({
  l1: r[0], l2: r[1], l3: r[2],
  question: (r[3] || '').trim().toLowerCase(),
  flag: (r[6] || '').toLowerCase().trim(),
  source: 'loan_repo'
})).filter(e => e.question);

// Load Insurance repo
const insWb = XLSX.readFile(INS_REPO);
const insRows = XLSX.utils.sheet_to_json(insWb.Sheets[insWb.SheetNames[0]], { header: 1 }).slice(1);
const insEntries = insRows.map(r => ({
  l1: r[0], l2: r[1], l3: r[2],
  question: (r[3] || '').trim().toLowerCase(),
  flag: (r[5] || '').toLowerCase().trim(),
  source: 'ins_repo'
})).filter(e => e.question);

const jsonQs   = new Set(jsonEntries.map(e => e.question));
const loanQs   = new Set(loanEntries.map(e => e.question));
const insQs    = new Set(insEntries.map(e => e.question));

// Overlap analysis
const inBoth_loan    = loanEntries.filter(e => jsonQs.has(e.question));
const loanOnly       = loanEntries.filter(e => !jsonQs.has(e.question));
const inBoth_ins     = insEntries.filter(e => jsonQs.has(e.question));
const insOnly        = insEntries.filter(e => !jsonQs.has(e.question));
const jsonOnly_loan  = jsonEntries.filter(e => e.l1 === 'Loan' && !loanQs.has(e.question));
const jsonOnly_ins   = jsonEntries.filter(e => e.l1 === 'Insurance' && !insQs.has(e.question));

console.log('=== JSON FILES ===');
console.log('Total entries:', jsonEntries.length);
console.log('Chatbot-flag=yes:', jsonEntries.filter(e => e.flag === 'yes').length);
console.log('Unique L2s:', [...new Set(jsonEntries.map(e => e.l2))].sort().join(', '));

console.log('\n=== LOAN REPO ===');
console.log('Total entries:', loanEntries.length);
console.log('Flag=yes:', loanEntries.filter(e => e.flag === 'yes').length);
console.log('In JSON too:', inBoth_loan.length);
console.log('Loan repo ONLY (not in JSONs):', loanOnly.length);
console.log('Flag=yes AND loan-only:', loanOnly.filter(e => e.flag === 'yes').length);
console.log('\nSample loan-only questions (flag=yes):');
loanOnly.filter(e => e.flag === 'yes').slice(0, 5).forEach(e =>
  console.log(' ', e.l2, '|', e.l3, '|', e.question.slice(0, 80))
);

console.log('\n=== INSURANCE REPO ===');
console.log('Total entries:', insEntries.length);
console.log('Flag=yes:', insEntries.filter(e => e.flag === 'yes').length);
console.log('In JSON too:', inBoth_ins.length);
console.log('Insurance repo ONLY (not in JSONs):', insOnly.length);
console.log('Flag=yes AND ins-only:', insOnly.filter(e => e.flag === 'yes').length);

console.log('\n=== IN JSONs BUT NOT IN REPOS ===');
console.log('Loan L2s in JSONs not in loan repo:', jsonOnly_loan.length);
console.log('Insurance L2s in JSONs not in ins repo:', jsonOnly_ins.length);
console.log('\nSample JSON-only Loan questions:');
jsonOnly_loan.slice(0, 5).forEach(e =>
  console.log(' ', e.l2, '|', e.l3, '|', e.question.slice(0, 80))
);

console.log('\n=== L2 COVERAGE COMPARISON ===');
const jsonL2s  = new Set(jsonEntries.filter(e => e.l1 === 'Loan').map(e => e.l2));
const loanL2s  = new Set(loanEntries.map(e => e.l2));
console.log('Loan L2s in JSONs only:', [...jsonL2s].filter(l => !loanL2s.has(l)).join(', '));
console.log('Loan L2s in repo only:', [...loanL2s].filter(l => !jsonL2s.has(l)).join(', '));
console.log('Loan L2s in both:', [...jsonL2s].filter(l => loanL2s.has(l)).join(', '));
