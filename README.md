# BLU Chatbot UAT Automation

Automated testing framework for Bajaj Finserv's BLU conversational AI (UAT).

Tests real customer utterances from the chat dump against the live bot, scores responses against JSON knowledge base ground truth, and produces a CSV + JSON report.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First-Time Setup](#first-time-setup)
3. [Data Setup](#data-setup)
4. [Generating Test Cases](#generating-test-cases)
5. [Running Tests](#running-tests)
6. [Module Filter Reference](#module-filter-reference)
7. [Understanding Results](#understanding-results)
8. [How Scoring Works](#how-scoring-works)
9. [Troubleshooting](#troubleshooting)
10. [For Contributors](#for-contributors)

---

## Prerequisites

- **Node.js** v18 or higher — [download here](https://nodejs.org/)
- **Git** — [download here](https://git-scm.com/)
- Access to the BLU UAT environment (mobile number + OTP bypass code from your team lead)
- The chat dump CSV (`3IN1 CHAT DATA DUMP.csv`) — obtain from Ishaan Bhatnagar

Check your Node version:
```bash
node --version
# Should print v18.x.x or higher
```

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_ORG/blu-automationV2.git
cd blu-automationV2
```

### 2. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Create your config file

```bash
cp run_config.json.example run_config.json
```

Open `run_config.json` and fill in your credentials:

```json
{
  "BLU_URL": "https://bflaiassist-uat.bajajfinserv.in/blu/?jid=blu",
  "BLU_MOBILE": "9876543210",
  "BLU_OTP": "123456",
  "BATCH_SIZE": 20,
  "FILTER_MODULE": "",
  "DELAY_BETWEEN_MSGS_MS": 2000,
  "BOT_REPLY_TIMEOUT_MS": 45000
}
```

> **Important:** `run_config.json` is gitignored and will never be committed. Never share your OTP bypass code over email or Slack.

---

## Data Setup

The chat dump CSV must be placed at:

```
data/3IN1 CHAT DATA DUMP.csv
```

This file is **not** in the repository (it contains customer data). Obtain it from Ishaan Bhatnagar.

The `data/` folder is gitignored — nothing in it will be committed.

---

## Generating Test Cases

Test cases are generated once from the JSON knowledge base + chat dump. Regenerate whenever the JSONs are updated.

```bash
node scripts/generate_test_cases_v4.js
```

This will:
- Read all JSON files from `JSON(s)/May 07 - Latest Content/`
- Map ~73K real user queries from the chat dump to JSON ground truth
- Select top 50 real user queries per L2 category
- Gap-fill with JSON verbatim questions for any L3 with no real user coverage
- Output `data/blu_test_cases_v4.json`

**Expected output:**
```
Total test cases: ~3,500
Module breakdown: [list of modules and counts]
```

> The data folder and chat dump CSV must both be present before running this.

---

## Running Tests

### Basic run (your module, batch of 20)

```bash
FILTER_MODULE="EMI_Card_Service" BATCH_SIZE=20 npx playwright test tests/blu_v4.test.js
```

### Run a specific L2

```bash
FILTER_MODULE="EMI_Card_Service" FILTER_L2="EMI Network Card" BATCH_SIZE=20 npx playwright test tests/blu_v4.test.js
```

### Run without module filter (all test cases)

```bash
BATCH_SIZE=20 npx playwright test tests/blu_v4.test.js
```

### Increase batch size (max ~15 before timeout)

```bash
FILTER_MODULE="Flexi_Loan_PL_Service" BATCH_SIZE=15 npx playwright test tests/blu_v4.test.js
```

> Results are saved to `results/` after every test case — even if the run crashes midway, partial results are preserved.

---

## Module Filter Reference

Use these exact strings for `FILTER_MODULE`:

| Module | CAI PO | What it covers |
|---|---|---|
| `Flexi_Loan_PL_Service` | Ishaan Bhatnagar | Personal Flexi Loan, Professional & Business Flexi Loan |
| `Flexi_Loan_SME_Service` | Ishaan Bhatnagar | SME Flexi Loan |
| `Flexi_Loan_Wheels_Service` | Ishaan Bhatnagar | Two Wheeler, New/Used Car, New/Used Tractor |
| `Term_Loan_PL_Service` | Ayushi Sharma | Personal Term Loan, Consumer Loan |
| `Term_Loan_PB_Service` | Ayushi Sharma | Professional & Business Term Loan |
| `Home_Loan_Service` | Irfan Shaikh | Home Loan |
| `Gold_Loan_Service` | Mekhala Dighe | Gold Loan |
| `Microfinance_Service` | Mekhala Dighe | Microfinance Group Loan |
| `Business_Secured_Loan_Service` | Mekhala Dighe | Business Secured Loan |
| `LAS_Service` | Ayushi Sharma | Loan Against Securities |
| `LAFD_Service` | Ishaan Bhatnagar | Loan Against Fixed Deposit |
| `EMI_Card_Service` | Ishaan Bhatnagar | EMI Network Card, Health EMI Network Card |
| `Credit_Card_Service` | — | Co-branded Credit Cards (discontinued) |
| `FD_SDP_Service` | Ishaan Bhatnagar | Fixed Deposit, SDP |
| `Insurance_Service` | Ayushi Sharma | Insurance Services |
| `Payments_UPI_Service` | Punit Bharmecha | UPI |
| `Payments_BBPS_Service` | Punit Bharmecha | BBPS |
| `Payments_Wallets_Service` | Punit Bharmecha | Wallets |
| `Fastag_Service` | — | Fastag |
| `Profile_Service` | Mekhala Dighe | Profile, DNC |
| `Rewards_Service` | — | Rewards |
| `Loan_Payments_Service` | — | Loan Payment Services |
| `Help_Support` | Ishaan Bhatnagar | Help on Raising a Request, Document Centre, KYC, CIBIL, KFS, Mandate |
| `Generic_Loan_Service` | — | Generic Loan Queries |
| `Generic_Cards_Service` | — | Generic Cards Queries |
| `Generic_Deposits_Service` | — | Generic Deposit Queries |
| `Other` | — | Unmapped / misc |

---

## Understanding Results

After each run, two files are created in `results/`:

```
results/
  run_2026-05-11T10-30-00.json   ← full structured data
  run_2026-05-11T10-30-00.csv    ← open in Excel / Google Sheets
```

### CSV Columns

| Column | Description |
|---|---|
| TC ID | Unique test case identifier |
| Module | Module tag (e.g. EMI_Card_Service) |
| L1 / L2 / L3 | Category hierarchy |
| Utterance | The query sent to the bot |
| Bot Reply | Full bot response (up to 1000 chars) |
| Expected Key Phrases | Phrases the bot should mention |
| Matched Phrases | Which phrases were actually found |
| CTA Expected | Whether a CTA button was expected |
| CTA Found | Whether a CTA was detected in the reply |
| Overall | **Pass / Fail / Manual Review** |
| Reason | Why it failed (if applicable) |
| Follow-up Rounds | How many follow-up turns were needed |
| Time (ms) | Response time in milliseconds |
| Mapping Type | `real_user` / `real_user_low_confidence` / `json_verbatim` |
| Mapping Confidence | 0–100 — how well the query matched the JSON |
| Scoring Type | `auto` (automated scoring) / `manual` (needs human review) |

### Overall Values

- **Pass** — bot replied with expected content and CTA (if applicable)
- **Fail** — bot gave wrong answer, error, or no CTA when expected
- **Manual Review** — answer depends on customer data; automated scoring not possible; human must review the Bot Reply column

---

## How Scoring Works

### Auto scoring (Static answers)
Used when the JSON answer does not depend on customer data.

1. Extract key phrases from JSON answer (CTA label, core instructions)
2. Check if bot reply contains at least 1 key phrase
3. If CTA is expected: check bot reply contains a CTA indicator (click, tap, apply, visit, etc.)
4. Both must pass → **Pass**

### Manual Review (Dynamic/Relational answers)
Used when the JSON answer references `customer_data` (e.g. EMI amounts, loan status, account details).

- Bot reply is logged in full
- Overall is set to `Manual Review`
- Human must open the CSV and verify the Bot Reply makes sense for the UAT account's actual data

### Mapping types
- `real_user` — confidence ≥ 30%; reliable ground truth
- `real_user_low_confidence` — confidence < 30%; treat results with caution; worth manual spot-check
- `json_verbatim` — JSON question used directly; highest reliability for scoring

---

## Troubleshooting

**"0 test cases matched filters"**
- Check spelling of `FILTER_MODULE` — must match exactly (case-sensitive)
- Run `node -e "const c=require('./data/blu_test_cases_v4.json'); console.log([...new Set(c.map(t=>t.module))].sort().join('\n'))"` to see all available modules

**"data/blu_test_cases_v4.json not found"**
- Run `node scripts/generate_test_cases_v4.js` first
- Make sure the chat dump CSV is at `data/3IN1 CHAT DATA DUMP.csv`

**Bot keeps showing "Retry" button**
- This is a UAT environment instability issue; the script waits up to 40s for retry to clear
- If it persists, restart the run

**OTP validation fails**
- Confirm your OTP bypass code is correct in `run_config.json`
- Check with Ishaan if the UAT bypass is active

**Test times out after ~10 cases**
- Playwright timeout is set to 600s (~15 cases max per run)
- Use `BATCH_SIZE=10` for slower bot environments
- Results up to the timeout are already saved in `results/`

**Consent screen keeps appearing mid-run**
- This is expected on first login; the script handles it automatically
- If it appears repeatedly, the UAT session may have expired — restart the run

---

## For Contributors

### Repository structure

```
blu-automationV2/
├── JSON(s)/
│   └── May 07 - Latest Content/   ← Knowledge base JSONs (do not edit)
├── scripts/
│   ├── generate_test_cases_v4.js  ← Main generator (edit this)
│   └── [legacy scripts]
├── tests/
│   └── blu_v4.test.js             ← Main test file (edit this)
├── data/                          ← Gitignored; CSV + generated JSON go here
├── results/                       ← Gitignored; run outputs go here
├── playwright.config.js
├── run_config.json.example        ← Template; copy to run_config.json
├── package.json
└── README.md
```

### When JSONs are updated

1. Drop new JSON files into `JSON(s)/May 07 - Latest Content/`
2. Rerun the generator: `node scripts/generate_test_cases_v4.js`
3. Run your module tests to verify

### Updating the module map

If a new L2 category is added to the JSONs, add it to the `MODULE_MAP` object in `scripts/generate_test_cases_v4.js`:

```javascript
'l1::new l2 name (lowercase)': 'Module_Tag_Name',
```

Then regenerate test cases.

### Commit checklist

```bash
# Only commit these — never commit data/ or results/ or run_config.json
git add scripts/
git add tests/
git add playwright.config.js
git add run_config.json.example
git add README.md
git commit -m "your message"
git push
```

---

## Quick Reference

```bash
# Setup (once)
npm install && npx playwright install chromium
cp run_config.json.example run_config.json
# Edit run_config.json with your credentials

# Generate test cases (once, or after JSON updates)
node scripts/generate_test_cases_v4.js

# Run your module
FILTER_MODULE="EMI_Card_Service" BATCH_SIZE=20 npx playwright test tests/blu_v4.test.js

# Run a specific L2
FILTER_MODULE="EMI_Card_Service" FILTER_L2="EMI Network Card" BATCH_SIZE=20 npx playwright test tests/blu_v4.test.js

# Results in:
# results/run_<timestamp>.csv   ← open in Excel
# results/run_<timestamp>.json  ← structured data
```
