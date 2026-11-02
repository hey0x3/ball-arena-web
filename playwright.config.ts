import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', timeout: process.env.CI ? 120_000 : 60_000, fullyParallel: false, workers: 1,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: process.env.CI ? [['github'], ['line']] : [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 800 } } }],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: process.env.CI ? 60_000 : 30_000 },
});
