const { test, expect } = require('@playwright/test');

test('Health check: STL → STEP trên trang thật', async ({ page }) => {
  await page.goto(process.env.LIVE_URL);
  await page.setInputFiles('#file', 'tests/fixtures/cube.stl');

  // SAO CHÉP nguyên dòng định nghĩa goBtn và dòng click từ tests/e2e.spec.js (khoảng dòng 22 đến 25)
  const goBtn = page.locator('#go');
  await expect(goBtn).toBeEnabled({ timeout: 10000 });
  await goBtn.click();

  const dlLink = page.locator('#dl');
  await expect(dlLink).toBeVisible({ timeout: 90000 });
  const downloadAttr = await dlLink.getAttribute('download');
  expect(downloadAttr).toMatch(/\.step$/i);
});
