const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

async function uploadAndConvert(page, filename) {
  const filePath = path.join(FIXTURES_DIR, filename);
  await page.goto('/');

  // Đảm bảo tùy chọn "Khôi phục mặt cong" được bật
  const recoverCurves = page.locator('#recoverCurves');
  if (!(await recoverCurves.isChecked())) {
    await recoverCurves.check();
  }

  await page.setInputFiles('#file', filePath);
  const goBtn = page.locator('#go');
  await expect(goBtn).toBeEnabled({ timeout: 10000 });
  await goBtn.click();
}

async function waitForConversionFinish(page) {
  const dlLink = page.locator('#dl');
  await expect(dlLink).toBeVisible({ timeout: 90000 });
}

test.describe('Kiểm thử cấu trúc STEP sạch cho hình trụ giải tích (ROADMAP mục 2)', () => {
  const models = [
    { filename: 'cylinder_8x20_96.stl', label: 'cylinder_8x20_96.stl (96 đoạn)' },
    { filename: 'cylinder_30x6.stl', label: 'cylinder_30x6.stl (48 đoạn)' },
  ];

  for (const m of models) {
    test(`Mô hình ${m.label} phải xuất ra STEP giải tích sạch (EDGE_CURVE <= 6, 1 mặt trụ)`, async ({ page }) => {
      await uploadAndConvert(page, m.filename);
      await waitForConversionFinish(page);

      const stepContent = await page.evaluate(async () => {
        const a = /** @type {HTMLAnchorElement|null} */ (document.getElementById('dl'));
        if (!a || !a.href) return null;
        const res = await fetch(a.href);
        return await res.text();
      });

      expect(stepContent).toBeTruthy();
      expect(stepContent).toContain('ISO-10303-21');

      // Đếm số lượng thực thể trong STEP
      const cylMatches = stepContent.match(/CYLINDRICAL_SURFACE/g) || [];
      const faceMatches = stepContent.match(/ADVANCED_FACE/g) || [];
      const edgeMatches = stepContent.match(/EDGE_CURVE/g) || [];
      const planeMatches = stepContent.match(/PLANE\s*\(/g) || [];

      console.log(`Kết quả đếm thực thể trong STEP [${m.filename}]:`);
      console.log(`  CYLINDRICAL_SURFACE: ${cylMatches.length}`);
      console.log(`  ADVANCED_FACE: ${faceMatches.length}`);
      console.log(`  PLANE: ${planeMatches.length}`);
      console.log(`  EDGE_CURVE: ${edgeMatches.length}`);

      // Tiêu chí kiểm tra cấu trúc STEP sạch:
      // 1. Đúng 1 mặt trụ giải tích
      expect(cylMatches.length).toBe(1);

      // 2. Mặt bên trụ: đúng 1 ADVANCED_FACE trên CYLINDRICAL_SURFACE; tổng mặt của khối trụ đơn = 3 (1 mặt bên + 2 đáy)
      expect(faceMatches.length).toBe(3);

      // 3. Tổng EDGE_CURVE của trụ đơn không quá 6
      expect(edgeMatches.length).toBeLessThanOrEqual(6);
    });
  }
});
