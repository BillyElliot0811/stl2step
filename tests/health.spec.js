// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('Health check: tải cube.stl từ LIVE_URL và có link .step', async ({ page }) => {
  const LIVE_URL = process.env.LIVE_URL;
  if (!LIVE_URL) throw new Error('Biến môi trường LIVE_URL chưa được đặt');

  // Mở trang thực (GitHub Pages)
  await page.goto(LIVE_URL, { timeout: 30000 });
  await expect(page.locator('#drop')).toBeVisible({ timeout: 15000 });

  // Tải fixture cube.stl để upload
  const fixturePath = path.resolve(__dirname, 'fixtures', 'cube.stl');
  if (!fs.existsSync(fixturePath))
    throw new Error(`Không tìm thấy fixture: ${fixturePath}`);

  // Nhập file
  await page.setInputFiles('#file', fixturePath);
  await expect(page.locator('#go')).toBeEnabled({ timeout: 10000 });
  await page.locator('#go').click();

  // Chờ link tải STEP xuất hiện hoặc lỗi
  await page.waitForFunction(() => {
    const dl = document.getElementById('dl');
    const err = document.getElementById('errorBox');
    if (dl && dl.getAttribute('href')) return true;
    if (err && !err.hidden) throw new Error('Hiển thị lỗi khi chuyển đổi');
    return false;
  }, null, { timeout: 120000 });

  const dlLink = page.locator('#dl');
  await expect(dlLink).toBeVisible();
  const href = await dlLink.getAttribute('href');
  expect(href).toMatch(/\.step$/i);
});
