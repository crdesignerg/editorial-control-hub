import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true, trace: 'off' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
