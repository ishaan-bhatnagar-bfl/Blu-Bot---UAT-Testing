/**
 * fix_v7_malformed_rows.js v2
 *
 * Proper RFC-4180 CSV parser that handles:
 * - Quoted fields with embedded newlines
 * - Quoted fields with embedded commas
 * - Column-count mismatches (unquoted commas in Expected Behaviour)
 *
 * Reads V7, fixes Type/In-KB columns on shifted rows, rewrites clean.
 */

const fs   = require('fs')
const path = require('path')

const V7 = path.join(__dirname, '..', 'automation', 'test-output', 'blu_test_cases_v7.csv')
const EXPECTED_COLS = 13

// ── RFC-4180 CSV parser ───────────────────────────────────────────────────────
function parseFullCSV(text) {
  const rows = []
  let row = [], field = '', inQuote = false, i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue }  // escaped quote
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

// ── Main ──────────────────────────────────────────────────────────────────────
const text = fs.readFileSync(V7, 'utf8')
const rows = parseFullCSV(text)
const header = rows[0]
console.log(`Parsed ${rows.length - 1} rows, ${header.length} cols`)
console.log(`Header: ${header.join(' | ')}`)

const VALID_TYPES = new Set(['Service','Payments','Rewards','Negative'])

let clean = 0, fixed = 0, skipped = 0
const outRows = [header]

for (let i = 1; i < rows.length; i++) {
  const vals = rows[i]
  if (!vals || vals.every(v => !v.trim())) continue  // blank row

  if (vals.length === EXPECTED_COLS) {
    // Check if Type is valid — fix if not (leftover junk from previous partial fix)
    if (!VALID_TYPES.has(vals[9])) {
      const mod = vals[1] || ''
      vals[9] = /upi|bbps|wallet|fastag|payment/i.test(mod) ? 'Payments' : 'Service'
      fixed++
    } else {
      clean++
    }
    outRows.push(vals)
    continue
  }

  if (vals.length < EXPECTED_COLS) {
    // Too few — skip genuinely broken rows
    console.log(`  Row ${i}: only ${vals.length} cols — "${(vals[0]||'').substring(0,20)}" — skipping`)
    skipped++
    continue
  }

  // Too many — Expected Behaviour has unescaped commas
  // cols 0-5 are safe, last 6 cols are KeyPhrases..Source, middle is ExpBeh
  const excess = vals.length - EXPECTED_COLS
  const fixedVals = [
    ...vals.slice(0, 6),
    vals.slice(6, 7 + excess).join(', '),
    ...vals.slice(7 + excess),
  ]

  if (fixedVals.length !== EXPECTED_COLS) {
    console.log(`  Row ${i}: couldn't fix (${vals.length} cols) — skipping`)
    skipped++
    continue
  }

  if (!VALID_TYPES.has(fixedVals[9])) {
    const mod = fixedVals[1] || ''
    fixedVals[9] = /upi|bbps|wallet|fastag|payment/i.test(mod) ? 'Payments' : 'Service'
  }

  outRows.push(fixedVals)
  fixed++
}

const out = outRows.map(r => r.map(escCSV).join(',')).join('\n')
fs.writeFileSync(V7, out, 'utf8')

console.log(`\n✅ Done`)
console.log(`   Clean:   ${clean}`)
console.log(`   Fixed:   ${fixed}`)
console.log(`   Skipped: ${skipped}`)
console.log(`   Total:   ${outRows.length - 1} rows written`)
