// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Cấu hình Playwright cho bộ kiểm thử E2E web stl2step
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  // oc.wasm (~63 MiB) có thể mất 45 - 90 giây để nạp và khởi tạo WASM
  timeout: 180000,
  expect: {
    timeout: 15000,
  },
  // Chạy tuần tự 1 worker để tránh nạp nhiều WASM 63MB cùng lúc gây tràn bộ nhớ/CPU
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python serve.py --no-browser --port 8000',
    url: 'http://127.0.0.1:8000/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
