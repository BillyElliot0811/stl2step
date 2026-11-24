// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function computeStlMeshVolume(stlPath) {
  const content = fs.readFileSync(stlPath, 'utf8');
  let vol = 0;
  const regex = /facet\s+normal[\s\S]*?vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)[\s\S]*?vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)[\s\S]*?vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const v1 = [+match[1], +match[2], +match[3]];
    const v2 = [+match[4], +match[5], +match[6]];
    const v3 = [+match[7], +match[8], +match[9]];
    vol += (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
            v1[1] * (v2[2] * v3[0] - v2[0] * v3[2]) +
            v1[2] * (v2[0] * v3[1] - v2[1] * v3[0])) / 6;
  }
  return Math.abs(vol);
}

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

async function waitForConversionFinish(page, timeout = 60000) {
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

test.describe('Kiểm thử nhận dạng mặt trụ TỔNG QUÁT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#drop')).toBeVisible({ timeout: 15000 });
  });

  const testCylinders = [
    { filename: 'cylinder_8x20_96.stl', r: 8, h: 20, segs: 96, maxDiff: 0.001, label: 'Lưới mịn >= 96 đoạn (đạt tiêu chí ROADMAP <= 0.1%)' },
    { filename: 'cylinder_8x20.stl', r: 8, h: 20, segs: 48, maxDiff: 0.003, label: 'Lưới 48 đoạn (giới hạn đa giác nội tiếp <= 0.3%)' },
    { filename: 'cylinder_30x6.stl', r: 30, h: 6, segs: 48, maxDiff: 0.003, label: 'Lưới 48 đoạn (giới hạn đa giác nội tiếp <= 0.3%)' },
    { filename: 'cylinder_12x40.stl', r: 12, h: 40, segs: 48, maxDiff: 0.003, label: 'Lưới 48 đoạn (giới hạn đa giác nội tiếp <= 0.3%)' },
  ];

  for (const c of testCylinders) {
    test(`Mô hình ${c.filename} (R=${c.r}, H=${c.h}, N=${c.segs}) - ${c.label}`, async ({ page }) => {
      const meshVolume = computeStlMeshVolume(path.join(FIXTURES_DIR, c.filename));
      expect(meshVolume).toBeGreaterThan(0);

      await uploadAndConvert(page, c.filename);
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

      // Đếm số lượng CYLINDRICAL_SURFACE
      const cylMatches = stepContent.match(/CYLINDRICAL_SURFACE/g) || [];
      console.log(`${c.filename}: số mặt CYLINDRICAL_SURFACE = ${cylMatches.length}`);
      // Yêu cầu: đúng 1 mặt trụ
      expect(cylMatches.length).toBe(1);

      // Đếm số lượng ADVANCED_FACE (1 mặt trụ + 2 mặt đáy = 3 mặt)
      const faceMatches = stepContent.match(/ADVANCED_FACE/g) || [];
      console.log(`${c.filename}: tổng số mặt ADVANCED_FACE = ${faceMatches.length}`);
      expect(faceMatches.length).toBeLessThanOrEqual(4);

      // Trích xuất bán kính trụ từ STEP
      // Định dạng: CYLINDRICAL_SURFACE ( '', #..., <radius> )
      const cylRadiusMatch = stepContent.match(/CYLINDRICAL_SURFACE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*([-\d.eE]+)\s*\)/);
      expect(cylRadiusMatch).toBeTruthy();
      const rStep = parseFloat(cylRadiusMatch[1]);
      const diameter = 2 * rStep;

      // Đo đường kính và bán kính thực trong file STEP: phải đúng 100% kích thước danh nghĩa (R=8.00 -> D=16.00 mm)
      console.log(`${c.filename}: STEP Radius=${rStep.toFixed(3)} mm, Diameter=${diameter.toFixed(3)} mm (kỳ vọng: D=${(2*c.r).toFixed(2)} mm)`);
      expect(Math.abs(rStep - c.r)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(diameter - 2 * c.r)).toBeLessThanOrEqual(0.001);

      // Thể tích hình trụ tròn thật từ STEP
      const stepVolume = Math.PI * rStep * rStep * c.h;
      // Sai lệch lý thuyết giữa hình tròn và đa giác N cạnh nội tiếp
      const theoreticalRelDiff = (Math.PI - (c.segs / 2) * Math.sin((2 * Math.PI) / c.segs)) / ((c.segs / 2) * Math.sin((2 * Math.PI) / c.segs));
      const actualRelDiff = (stepVolume - meshVolume) / meshVolume;
      console.log(`${c.filename}: meshVol=${meshVolume.toFixed(3)} mm3, stepVol=${stepVolume.toFixed(3)} mm3, chênh lệch thực tế=${(actualRelDiff * 100).toFixed(4)}% (lý thuyết hình học: ${(theoreticalRelDiff * 100).toFixed(4)}%)`);
      
      // ASSERT THỰC SỰ theo tiêu chí:
      expect(stepVolume).toBeGreaterThan(meshVolume);
      expect(actualRelDiff).toBeLessThanOrEqual(c.maxDiff);
      expect(Math.abs(actualRelDiff - theoreticalRelDiff)).toBeLessThanOrEqual(0.0001);
    });
  }
});
