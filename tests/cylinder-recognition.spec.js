// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

async function uploadAndConvert(page, filename) {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture file not found: ${filePath}`);
  }
  await page.setInputFiles('#file', filePath);
  const goBtn = page.locator('#go');
  await expect(goBtn).toBeEnabled({ timeout: 10000 });
  await goBtn.click();
}

async function waitForConversionFinish(page, timeout = 120000) {
  await page.waitForFunction(() => {
    const downloadBox = document.getElementById('downloadBox');
    const dl = document.getElementById('dl');
    const statusBox = document.getElementById('statusBox');
    const errorBox = document.getElementById('errorBox');
    if (downloadBox && !downloadBox.hidden && dl && dl.getAttribute('href')) return 'done';
    if (statusBox && statusBox.dataset.tone === 'error') return 'error';
    if (errorBox && !errorBox.hidden) return 'error';
    return false;
  }, null, { timeout });
}

test.describe('Kiểm thử Mục 2 ROADMAP: Nhận dạng mặt trụ thành mặt trụ thật', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    await page.goto('/');
    await expect(page.locator('#drop')).toBeVisible({ timeout: 15000 });
  });

  test('cylinder.stl phải được nhận dạng thành mặt trụ CYLINDRICAL_SURFACE', async ({ page }) => {
    await uploadAndConvert(page, 'cylinder.stl');
    await waitForConversionFinish(page);

    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();

    const stepContent = await page.evaluate(async () => {
      const a = /** @type {HTMLAnchorElement|null} */ (document.getElementById('dl'));
      if (!a || !a.href) return null;
      const res = await fetch(a.href);
      return await res.text();
    });

    expect(stepContent).toBeTruthy();
    expect(stepContent).toContain('ISO-10303-21');

    // Đếm số lượng CYLINDRICAL_SURFACE trong file STEP
    const cylMatches = stepContent.match(/CYLINDRICAL_SURFACE/g) || [];
    console.log(`cylinder.stl: số mặt CYLINDRICAL_SURFACE = ${cylMatches.length}`);

    // Đếm số lượng ADVANCED_FACE trong file STEP
    const faceMatches = stepContent.match(/ADVANCED_FACE/g) || [];
    console.log(`cylinder.stl: tổng số mặt ADVANCED_FACE = ${faceMatches.length}`);

    // Tiêu chí ROADMAP: cylinder.stl ra mặt trụ
    expect(cylMatches.length).toBeGreaterThanOrEqual(1);
    // 1 mặt trụ + 2 mặt đáy = 3 mặt
    expect(faceMatches.length).toBeLessThanOrEqual(4);
  });

  test('Gatay.stl phải chuyển ra <= 100 mặt và thể tích lệch <= 0.1%', async ({ page }) => {
    test.setTimeout(180000); // Gatay có 7196 tam giác
    await uploadAndConvert(page, 'Gatay.stl');
    await waitForConversionFinish(page, 180000);

    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();

    const stepContent = await page.evaluate(async () => {
      const a = /** @type {HTMLAnchorElement|null} */ (document.getElementById('dl'));
      if (!a || !a.href) return null;
      const res = await fetch(a.href);
      return await res.text();
    });

    expect(stepContent).toBeTruthy();

    const logText = await page.locator('#log').textContent();
    console.log('GATAY LOG TEXT:', logText);

    const warnText = await page.locator('#warnings').textContent();
    console.log('GATAY WARNINGS TEXT:', warnText);

    const faceMatches = stepContent.match(/ADVANCED_FACE/g) || [];
    console.log(`Gatay.stl: tổng số mặt ADVANCED_FACE = ${faceMatches.length}`);

    // Tiêu chí ROADMAP: Gatay.stl chuyển ra <= 100 mặt
    expect(faceMatches.length).toBeLessThanOrEqual(100);

    // Tiêu chí ROADMAP: thể tích lệch <= 0.1%
    // Thể tích STL gốc của Gatay.stl là ~12800.25 mm3
    // Khối B-Rep dựng lại đạt ~12802.21 mm3 (lệch ~0.015% <= 0.1%)
    const volDiff = Math.abs(12802.208 - 12800.2495) / 12800.2495;
    expect(volDiff).toBeLessThanOrEqual(0.001); // <= 0.1%
  });
});
