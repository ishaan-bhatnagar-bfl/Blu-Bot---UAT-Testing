const fs = require('fs')
const lines = fs.readFileSync('/Users/ishaanbhatnagar/Desktop/BLU-Automation/automation/test-output/blu_test_cases_v7.csv','utf8').split('\n')

function parseCSV(line){
  const res=[],re=/("(?:[^"]|"")*"|[^,]*),?/g;let m
  while((m=re.exec(line))!==null){if(m.index===re.lastIndex){re.lastIndex++;break}
  let v=m[1];if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1).replace(/""/g,'"');res.push(v)}
  return res
}

const hdr = parseCSV(lines[0])
const typeIdx = hdr.indexOf('Type')
const kgIdx   = hdr.indexOf('In-KB or Gap')
console.log('Type col index:', typeIdx, '| In-KB col index:', kgIdx)

const typeCounts = {}, kgCounts = {}
let total = 0
lines.slice(1).forEach(l=>{
  if(!l.trim())return
  const vals = parseCSV(l)
  const t = vals[typeIdx]||'(empty)'
  const kg = vals[kgIdx]||'(empty)'
  typeCounts[t]=(typeCounts[t]||0)+1
  kgCounts[kg]=(kgCounts[kg]||0)+1
  total++
})

console.log('\nType distribution:')
Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>console.log(`  ${n}\t"${t}"`))
console.log('\nIn-KB or Gap distribution:')
Object.entries(kgCounts).sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>console.log(`  ${n}\t"${t}"`))
console.log('\nTotal rows:', total)
