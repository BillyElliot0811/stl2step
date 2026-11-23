module.exports = {
  testDir: './tests',
  testMatch: 'health.spec.js',
  timeout: 120000,
  use: {
    headless: true,
    baseURL: process.env.LIVE_URL,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
};
