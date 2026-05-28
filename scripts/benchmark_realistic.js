#!/usr/bin/env node
/**
 * benchmark_realistic.js
 *
 * Compares verdict distributions between two exported CSVs:
 *   - V7 baseline (KB-verbatim questions)
 *   - Realistic variants (real-user phrasing)
 *
 * Reports pass rate drop per module and per L3 topic.
 *
 * Usage:
 *   node scripts/benchmark_realistic.js <baseline.csv> <realistic.csv>
 */

const fs   = require('fs')
const path = require('path')

const [,, baselineFile, realisticFile] = process.argv
if (!baselineFile || !realisticFile) {
  console.error('Usage: node benchmark_realistic.js <baseline.csv> <realistic.csv>')
  process.exit(1)
}

function parseCSVLine(line) {
  const res = [], re = /("(?:[^"]|"")*"|[^,]*),?/g
  let m
  while ((m = re.exec(line)) !== null) {
    if (m.index === re.lastIndex) { re.lastIndex++; break }
    let v = m[1]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"')
    res.push(v)
  }
  return res
}

function loadCSV(filePath) {
  if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1) }
  const lines  = fs.readFileSync(filePath, 'utf8').split('\n')
  const header = parseCSVLine(lines[0])
  const rows   = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseCSVLine(lines[i])
    const row  = {}
    header.forEach((h, idx) => { row[h] = (vals[idx] || '').trim() })
    if (row['Module']) rows.push(row)
  }
  return rows
}

function stats(rows) {
  const total  = rows.length
  const pass   = rows.filter(r => r['Verdict'] === 'PASS' || r['Manual Result'] === 'pass').length
  const fail   = rows.filter(r => r['Verdict'] === 'FAIL' || r['Manual Result'] === 'fail').length
  const review = rows.filter(r => r['Verdict'] === 'REVIEW').length
  const pct    = total ? Math.round((pass / total) * 100) : 0
  return { total, pass, fail, review, pct }
}

function delta(b, r) { const d = r.pct - b.pct; return (d >= 0 ? '+' : '') + d + '%' }
function flag(b, r)  { const d = r.pct - b.pct; return d <= -20 ? '🔴' : d <= -10 ? '🟡' : '🟢' }
function pad(s, n)   { return String(s).padEnd(n) }
function lpad(s, n)  { return String(s).padStart(n) }

function buildReport(baseRows, realRows) {
  const lines = [], hr = '─'.repeat(80)

  lines.push('')
  lines.push('BLU Bot — Realistic Variant Benchmark Report')
  lines.push(`Generated: ${new Date().toLocaleString('en-IN')}`)
  lines.push(`Baseline:  ${baselineFile} (${baseRows.length} cases)`)
  lines.push(`Realistic: ${realisticFile} (${realRows.length} cases)`)
  lines.push(hr)

  const bAll = stats(baseRows), rAll = stats(realRows)
  lines.push('\nOVERALL')
  lines.push(`  Baseline  : ${bAll.pass}/${bAll.total} PASS (${bAll.pct}%)  FAIL ${bAll.fail}  REVIEW ${bAll.review}`)
  lines.push(`  Realistic : ${rAll.pass}/${rAll.total} PASS (${rAll.pct}%)  FAIL ${rAll.fail}  REVIEW ${rAll.review}`)
  lines.push(`  Delta     : ${flag(bAll, rAll)} ${delta(bAll, rAll)} pass rate`)
  lines.push('')

  lines.push(hr)
  lines.push('BY MODULE')
  lines.push(hr)
  lines.push(`${pad('Module', 36)} ${lpad('Base%', 6)} ${lpad('Real%', 6)} ${lpad('Delta', 7)}  Flag`)
  lines.push(hr)

  const groupBy = (rows, key) => {
    const g = {}
    rows.forEach(r => { const k = r[key] || '(unknown)'; if (!g[k]) g[k] = []; g[k].push(r) })
    return g
  }

  const baseMods = groupBy(baseRows, 'Module')
  const realMods = groupBy(realRows, 'Module')
  const allMods  = [...new Set([...Object.keys(baseMods), ...Object.keys(realMods)])].sort()
  const modDeltas = []

  for (const mod of allMods) {
    const b = stats(baseMods[mod] || []), r = stats(realMods[mod] || [])
    modDeltas.push({ mod, b, r, d: r.pct - b.pct })
    lines.push(`${pad(mod.replace(/_Service$/, '').replace(/_/g, ' '), 36)} ${lpad(b.pct + '%', 6)} ${lpad(r.pct + '%', 6)} ${lpad(delta(b, r), 7)}  ${flag(b, r)}`)
  }
  lines.push('')

  lines.push(hr)
  lines.push('BIGGEST L3 REGRESSIONS (drop ≥ 10%)')
  lines.push(hr)
  lines.push(`${pad('Module', 28)} ${pad('L3', 28)} ${lpad('Base%', 6)} ${lpad('Real%', 6)} ${lpad('Delta', 7)}`)
  lines.push(hr)

  const baseL3 = {}, realL3 = {}
  baseRows.forEach(r => { const k = `${r['Module']}|||${r['L3']}`; if (!baseL3[k]) baseL3[k] = []; baseL3[k].push(r) })
  realRows.forEach(r => { const k = `${r['Module']}|||${r['L3']}`; if (!realL3[k]) realL3[k] = []; realL3[k].push(r) })

  const regressions = []
  for (const key of Object.keys(baseL3)) {
    const [mod, l3] = key.split('|||')
    const b = stats(baseL3[key]), r = stats(realL3[key] || [])
    if (r.total === 0) continue
    const d = r.pct - b.pct
    if (d <= -10) regressions.push({ mod, l3, b, r, d })
  }
  regressions.sort((a, b) => a.d - b.d)

  if (!regressions.length) {
    lines.push('  No L3 regressions ≥ 10% found.')
  } else {
    regressions.forEach(({ mod, l3, b, r }) => {
      lines.push(`${pad(mod.replace(/_Service$/, '').replace(/_/g, ' '), 28)} ${pad(l3.substring(0, 27), 28)} ${lpad(b.pct + '%', 6)} ${lpad(r.pct + '%', 6)} ${lpad(delta(b, r), 7)}`)
    })
  }
  lines.push('')

  lines.push(hr)
  lines.push('SUMMARY')
  const red    = modDeltas.filter(x => x.d <= -20).map(x => x.mod.replace(/_Service$/, ''))
  const yellow = modDeltas.filter(x => x.d > -20 && x.d <= -10).map(x => x.mod.replace(/_Service$/, ''))
  if (red.length)    lines.push(`  🔴 Critical regression (≥20% drop): ${red.join(', ')}`)
  if (yellow.length) lines.push(`  🟡 Moderate regression (10-20% drop): ${yellow.join(', ')}`)
  if (!red.length && !yellow.length) lines.push('  🟢 No significant regressions.')
  lines.push('')

  return lines.join('\n')
}

const baseRows = loadCSV(baselineFile)
const realRows = loadCSV(realisticFile)
const report   = buildReport(baseRows, realRows)
console.log(report)

const outFile = path.join(path.dirname(baselineFile), `benchmark_report_${new Date().toISOString().slice(0, 10)}.txt`)
fs.writeFileSync(outFile, report, 'utf8')
console.log(`\nReport saved → ${outFile}`)
