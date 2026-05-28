/**
 * reconstruct_v7.js
 *
 * Reconstructs blu_test_cases_v7.csv from blu_test_cases_v7_realistic.csv
 * The realistic CSV has all original rows plus an 'Original Question' column.
 * We restore V7 by using 'Original Question' as 'Test Question'.
 * Then appends negative cases from blu_negative_test_cases.csv.
 */

const fs   = require('fs')
const path = require('path')

const REALISTIC = path.join(__dirname, '..', 'automation', 'test-output', 'blu_test_cases_v7_realistic.csv')
const NEGATIVE  = path.join(__dirname, '..', 'automation', 'test-output', 'blu_negative_test_cases.csv')
const OUT       = path.join(__dirname, '..', 'automation', 'test-output', 'blu_test_cases_v7.csv')

function parseFullCSV(text) {
  const rows = []
  let row = [], field = '', inQuote = false, i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue }
        inQuote = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuote = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\r' && text[i+1] === '\n') { row.push(field); rows.push(row); row=[]; field=''; i+=2; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row=[]; field=''; i++; continue }
    field += ch; i++
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

function escCSV(v) { return `"${String(v || '').replace(/"/g, '""')}"` }

// ── Load realistic CSV ────────────────────────────────────────────────────────
const realRows  = parseFullCSV(fs.readFileSync(REALISTIC, 'utf8'))
const realHdr   = realRows[0]
console.log(`Realistic CSV: ${realRows.length - 1} rows, cols: ${realHdr.join(' | ')}`)

// Column indices in realistic CSV
const rTC       = realHdr.indexOf('TC ID')
const rMod      = realHdr.indexOf('Module')
const rL1       = realHdr.indexOf('L1')
const rL2       = realHdr.indexOf('L2')
const rL3       = realHdr.indexOf('L3')
const rOrigQ    = realHdr.indexOf('Original Question')
const rExpBeh   = realHdr.indexOf('Expected Behaviour')
const rKeyPhr   = realHdr.indexOf('Expected Key Phrases')
const rCTA      = realHdr.indexOf('CTA Expected')
const rType     = realHdr.indexOf('Type')
const rKG       = realHdr.indexOf('In-KB or Gap')
const rScoring  = realHdr.indexOf('Scoring Type')
const rSource   = realHdr.indexOf('Source')

if (rOrigQ === -1) { console.error('Original Question column not found'); process.exit(1) }

// V7 header
const V7_HDR = ['TC ID','Module','L1','L2','L3','Test Question','Expected Behaviour',
                 'Expected Key Phrases','CTA Expected','Type','In-KB or Gap','Scoring Type','Source']

const outRows = [V7_HDR]

// Reconstruct from realistic: use Original Question, restore Source=kb_verbatim_v7
for (let i = 1; i < realRows.length; i++) {
  const r = realRows[i]
  if (!r || r.every(v => !v.trim())) continue
  const tcId = r[rTC] || `TC_${String(i).padStart(5,'0')}`
  // Restore TC ID — realistic uses RV_ prefix, map back to TC_
  const origTc = tcId.startsWith('RV_') ? `TC_${tcId.slice(3)}` : tcId
  outRows.push([
    origTc,
    r[rMod]     || '',
    r[rL1]      || '',
    r[rL2]      || '',
    r[rL3]      || '',
    r[rOrigQ]   || '',   // Original Question → Test Question
    r[rExpBeh]  || '',
    r[rKeyPhr]  || '',
    r[rCTA]     || '',
    r[rType]    || 'Service',
    r[rKG]      || 'In-KB',
    r[rScoring] || 'auto',
    'kb_verbatim_v7',    // restore original source
  ])
}

console.log(`Reconstructed: ${outRows.length - 1} V7 rows`)

// ── Append negative cases ─────────────────────────────────────────────────────
const negRows = parseFullCSV(fs.readFileSync(NEGATIVE, 'utf8'))
const negHdr  = negRows[0]
const nTC     = negHdr.indexOf('TC ID')
const nMod    = negHdr.indexOf('Module')
const nL1     = negHdr.indexOf('L1')
const nL2     = negHdr.indexOf('L2')
const nL3     = negHdr.indexOf('L3')
const nQ      = negHdr.indexOf('Test Question')
const nExp    = negHdr.indexOf('Expected Behaviour')
const nKP     = negHdr.indexOf('Expected Key Phrases')
const nCTA    = negHdr.indexOf('CTA Expected')
const nType   = negHdr.indexOf('Type')
const nKG     = negHdr.indexOf('In-KB or Gap')
const nScoring= negHdr.indexOf('Scoring Type')
const nSource = negHdr.indexOf('Source')

// Get last TC number from reconstructed rows
const lastTc = outRows[outRows.length-1][0]
let tcCounter = parseInt(lastTc.replace('TC_','')) + 1

for (let i = 1; i < negRows.length; i++) {
  const r = negRows[i]
  if (!r || r.every(v => !v.trim())) continue
  outRows.push([
    `TC_${String(tcCounter).padStart(5,'0')}`,
    r[nMod]    || '',
    r[nL1]     || '',
    r[nL2]     || '',
    r[nL3]     || '',
    r[nQ]      || '',
    r[nExp]    || '',
    r[nKP]     || '',
    r[nCTA]    || '',
    'Service',           // Type=Service so visible under Service master
    'Negative',          // In-KB or Gap=Negative for ⚠ pill
    r[nScoring]|| 'manual',
    'negative_v1',
  ])
  tcCounter++
}

console.log(`After negative append: ${outRows.length - 1} total rows`)

// ── Write ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUT, outRows.map(r => r.map(escCSV).join(',')).join('\n'), 'utf8')
console.log(`\n✅ Written → ${OUT}`)
