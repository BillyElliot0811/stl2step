const { test, expect } = require('@playwright/test');

test('Health check: convert STL to STEP', async ({ page }) => {
  const liveUrl = process.env.LIVE_URL;
  await page.goto(liveUrl);

  // Upload cube STL fixture (copy selector from e2e test)
  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles('tests/fixtures/cube.stl');

  // Click convert button (selector from e2e test)
  await page.click('#convert-button');

  // Wait for download link to appear (max 90s)
  const downloadLink = await page.waitForSelector('#dl', { timeout: 90000 });
  const href = await downloadLink.getAttribute('href');
  expect(href).toMatch(/\.step$/);
});
