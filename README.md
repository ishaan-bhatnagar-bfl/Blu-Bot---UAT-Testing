# BLU Chatbot UAT Automation

Real user testing framework for Bajaj Finserv BLU conversational AI.

## Overview

- **73,454 real user queries** from 2-day chat dump
- **126 synthetic queries** for coverage gaps
- **Quality-based scoring** (response appropriateness, not keyword matching)
- **Multi-turn conversation support** (follow-ups, relation selection)
- **Retry handling** (30-second cooldown, error recovery)

## Quick Start

### Install
npm install

### Setup Config
cp run_config.json.bak run_config.json

### Run Tests
FILTER_L1=Loan FILTER_VARIATION="Real User" BATCH_SIZE=20 npx playwright test tests/blu_v3.test.js

## Results

Pass Rate: 10/10 (100%) on Loan category

## Contact

Owner: Ishaan Bhatnagar
