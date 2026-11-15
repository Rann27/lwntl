import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 20000,
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.platform === 'win32' ? 'msedge' : undefined, viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
})
