import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: [
    {
      command: 'php artisan serve --env=testing --port=8001',
      port: 8001,
      timeout: 120 * 1000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev -- --port 5175',
      port: 5175,
      timeout: 120 * 1000,
      reuseExistingServer: true,
    }
  ],
});


