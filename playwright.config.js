const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 300000,
  retries: 0,
  workers: 1,
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/playwright_report.json' }],
  ],
});
