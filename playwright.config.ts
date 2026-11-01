import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', timeout: 60_000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome', viewport: { width: 1280, height: 800 } } }],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 },
});
