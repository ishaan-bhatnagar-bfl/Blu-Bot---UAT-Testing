# BLU Bot — Test Automation

Automated + manual testing framework for **BLU Bot** (Bajaj Finance AI assistant) across N2P and UAT environments.

Built by the CAI Team. Maintainer: **Ishaan Bhatnagar** (Flexi Loans PL/SME, Flexi Wheels, LAFD, EMI Card, FD/SDP, Help & Support).

---

## Architecture

```
BLU-Automation/
├── dashboard/
│   ├── blu_test_dashboard_v4.html   ← Main test UI (open in browser)
│   ├── playwright_server.js         ← WebSocket bridge v3.0 (Node.js)
│   ├── verdict_engine.js            ← Structured keyword verdict rules
│   └── llm_verdict.js               ← LLM verdict via Ollama Llama 3.1 8B
│
├── scripts/
│   ├── aggregate_results.py         ← Post-run HTML + CSV report generator
│   ├── kb_update_trigger.py         ← Auto-pipeline on KB update
│   ├── generate_test_cases_v7.js    ← Test case generator v7.1
│   ├── extract_questions.sh
│   ├── paraphrase_generator.sh
│   ├── edge_case_generator.sh
│   └── regression_suite.sh
│
├── knowledge_base/
│   ├── JSONs/
│   │   ├── May 07 - Latest Content/   ← Previous KB (reference)
│   │   └── May 22 - Latest Content/   ← Active KB (84 JSON files)
│   └── Excels/
│
├── automation/
│   ├── test-output/
│   │   ├── blu_test_cases_v7.csv          ← Primary (2,321 cases, all modules)
│   │   ├── blu_test_cases_v3_paraphrased.csv  ← Master (129K real user cases)
│   │   ├── blu_regression_suite.csv       ← 50 critical regression cases
│   │   ├── blu_edge_cases.csv             ← 4,479 stress/edge cases
│   │   ├── blu_multiturn_test_cases.csv   ← 66 multi-turn flows
│   │   └── reports/                       ← Aggregated run reports
│   └── playwright.config.js
│
└── data/                             ← Gitignored — obtain from Ishaan
```

---

## Prerequisites

- **Node.js** v18+
- **Python 3.10+**
- **Ollama** (local LLM for verdict scoring) — `brew install ollama`
- **Llama 3.1 8B model** — see LLM Setup below
- Access to N2P/UAT test mobile + OTP — get from Ishaan Bhatnagar

---

## Quick Start

### 1. Clone
```bash
git clone https://github.com/ishaan-bhatnagar-bfl/BLU-Bot-Testing.git
cd BLU-Bot-Testing
```

### 2. Install Node dependencies
```bash
cd dashboard && npm install playwright ws
```

### 3. LLM Setup (one-time)
```bash
# Download Llama 3.1 8B (4.6GB — takes 10-15 mins)
curl -L --retry 10 --retry-delay 15 -C - \
  "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf" \
  -o ~/Desktop/llama3.1-8b-q4.gguf

# Register with Ollama
echo 'FROM /Users/<your-username>/Desktop/llama3.1-8b-q4.gguf' > ~/Desktop/Modelfile
ollama create llama3.1-local -f ~/Desktop/Modelfile
```

### 4. Start services (3 terminals)

**Terminal 1 — Ollama:**
```bash
ollama serve
```

**Terminal 2 — Bridge:**
```bash
cd dashboard && node playwright_server.js
```
Look for:
```
✅ Browser launched
🧠 Ollama available — LLM verdict enabled (llama3.1-local)
🚀 Bridge running on ws://localhost:3001
```

**Terminal 3 — Dashboard:**
```bash
open dashboard/blu_test_dashboard_v4.html
```

### 5. Connect and test
1. Select env: **N2P** or **UAT**
2. Click **Connect to Bot** → enter mobile → OTP
3. Load test CSV → filter by module → **⚡ Bulk Run**

---

## Environments

| Env | URL | OTP | Mobile |
|-----|-----|-----|--------|
| N2P | `https://bflaiassist-n2p.bajajfinserv.in/blu/?jid=blu` | Real OTP | `9953333141` |
| UAT | `https://bflaiassist-uat.bajajfinserv.in/blu/?jid=blu` | `123465` | PROD-mapped numbers only |

---

## Test Files

| File | Cases | Use for |
|------|-------|---------|
| `blu_test_cases_v7.csv` | 2,321 | Daily runs — all modules, KB-verbatim |
| `blu_test_cases_v3_paraphrased.csv` | 129K | Full coverage — real user utterances |
| `blu_regression_suite.csv` | 50 | Post-deploy sanity check |
| `blu_edge_cases.csv` | 4,479 | Stress: typos, Hinglish, truncated |
| `blu_multiturn_test_cases.csv` | 66 flows | Multi-turn manual testing |

Both V3 and V7 column formats load correctly — dashboard normalises on load.

---

## Verdict Engine

Every bot response is scored by two layers:

### Layer 1 — Keyword Rules (`verdict_engine.js`)
Fast, ~0ms. 8 structured rules:

| Rule | What it checks |
|------|---------------|
| `SOURCING_GUARD` | Query is not a Sourcing/apply intent |
| `NO_FALLBACK` | Response is not a fallback/retry card |
| `LANGUAGE` | Response language matches query language |
| `MIN_LENGTH` | Response meets minimum length for module |
| `CTA_PRESENT` | CTA detected when KB expects one |
| `NO_CROSS_PRODUCT` | No unrelated product mentions |
| `ESCALATION_CHECK` | Escalation matches KB expectation |
| `KEYWORD_MATCH` | Key phrases from KB present in response |

### Layer 2 — LLM Verdict (`llm_verdict.js`)
Semantic scoring via Ollama Llama 3.1 8B, ~3s.

- **Disambiguation detection** — "Please select the relation" → `REVIEW` (no LLM call)
- **Sourcing skip** — apply/new loan intent → `SOURCING_SKIP`
- **Hybrid logic** — LLM overrides keyword on disagreement
- **Fallback** — if Ollama not running, keyword verdict used silently

**Hybrid rules:**
- Both PASS → PASS
- Both FAIL → FAIL
- LLM FAIL + keyword PASS → FAIL
- LLM PASS + keyword FAIL → REVIEW
- Either REVIEW → REVIEW

**Terminal output per test:**
```
🤖 Response (1.2s): Your EMI card limit is ₹2.5L...
🧠 LLM: ✅ PASS (91%) — Response correctly states EMI card limit
```

Final verdict shows in dashboard response panel with full rule breakdown.

---

## Session Behaviour

- **Auto-reset after 30 messages** — bot navigates back to login
- **Re-auth detection** — server detects login screen and re-authenticates
  - UAT: uses `123465` automatically
  - N2P: shows inline OTP input in dashboard banner
- **Message queue** — incoming messages during retry countdown are queued, not dropped
- **Retry card handling** — server waits out countdown, clicks Retry when active

---

## Module Ownership

| Module | CAI PO |
|--------|--------|
| Flexi Loans PL / SME | Ishaan Bhatnagar |
| Flexi Wheels (NCF / UCF / TWF / NTR / UTR) | Ishaan Bhatnagar |
| LAFD | Ishaan Bhatnagar |
| EMI Card / Health EMI Card | Ishaan Bhatnagar |
| FD / SDP | Ishaan Bhatnagar |
| Help & Support (RAR & FAQ) | Ishaan Bhatnagar |
| Term Loan (PL & SME) | Ayushi Sharma |
| Term Wheels | Ayushi Sharma |
| LAS / ESOP / Insurance | Ayushi Sharma |
| Document Centre | Ayushi Sharma |
| Home Loan / LAP / BHFL | Irfan Shaikh |
| Upcoming EMI / Part-payment / Foreclosure | Irfan Shaikh |
| Gold Loan / Microfinance / B2B | Mekhala Dighe |
| Profile / DNC / Consent | Mekhala Dighe |
| Payments (UPI / BBPS / Wallets / FASTag) | Punit Bharmecha |
| DMS / EW | Punit Bharmecha |

**Zero-coverage modules** (chatbot-flag=yes missing in KB JSONs — content team action needed):
SME Flexi Loan, Home Loan, Loan Payments, Rewards, Help & Support

---

## Scope

- ✅ **In scope:** All Service modules
- ❌ **Out of scope:** Sourcing flows (apply/application journeys). CTAs pointing to sourcing are in scope; the journey itself is not.

---

## Reporting Bugs (ADO)

1. Failed case shows 🐛 Bug button — auto-fills failed rule names in description
2. Format: `CAI Team || WEB || [ENV] || [description]`
3. Click **Export + Copy** → paste into ADO

After a run, generate HTML report:
```bash
python3 scripts/aggregate_results.py <exported_results.csv>
# Output → automation/test-output/reports/report_YYYY-MM-DD.html
```

---

## When KB Updates

```bash
# Drop new JSONs into knowledge_base/JSONs/[new folder]/
python3 scripts/kb_update_trigger.py --new-folder "June 01 - Latest Content"
# Diff → automation/test-output/kb_diff_YYYY-MM-DD.csv

# Regenerate V7 test cases
node scripts/generate_test_cases_v7.js
```

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Done | Retry lock, re-auth, virtual scroll |
| Phase 2 | ✅ Done | LLM verdict via Llama 3.1 8B |
| Phase 3 | 🔜 Next | Dashboard revamp |
| Phase 4 | 🔜 Claude Code | Multi-turn runner, bulk resume, semantic scoring |

---

## Maintainer

Ishaan Bhatnagar — CAI Team, Bajaj Finance
