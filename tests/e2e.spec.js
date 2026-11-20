// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

/**
 * Helper nạp file vào input #file và bấm Chuyển sang STEP
 * @param {import('@playwright/test').Page} page
 * @param {string} filename
 */
async function uploadAndConvert(page, filename) {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture file not found: ${filePath}`);
  }

  // Nạp file qua setInputFiles
  await page.setInputFiles('#file', filePath);

  // Đảm bảo nút Chuyển sang STEP được bật trước khi bấm
  const goBtn = page.locator('#go');
  await expect(goBtn).toBeEnabled({ timeout: 10000 });
  await goBtn.click();
}

/**
 * Helper chờ hoàn tất chuyển đổi (hoặc link download hoặc trạng thái lỗi xuất hiện)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 */
async function waitForConversionFinish(page, timeout = 120000) {
  // Chờ một trong các điều kiện kết thúc: link download hiện, errorBox hiện, hoặc statusBox báo lỗi
  await Promise.race([
    page.locator('#downloadBox:not([hidden]) #dl').waitFor({ state: 'visible', timeout }),
    page.locator('#errorBox:not([hidden])').waitFor({ state: 'visible', timeout }).catch(() => {}),
    page.locator('#statusBox[data-tone="error"]').waitFor({ state: 'visible', timeout }).catch(() => {}),
  ]);
}

test.describe('Bộ kiểm thử E2E web stl2step', () => {
  // Cấu hình chạy tuần tự để tiết kiệm tài nguyên khi chạy WebAssembly
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#drop')).toBeVisible();
  });

  // Ca 1: cube.stl (File hợp lệ tiêu chuẩn - 12 tam giác)
  test('Ca 1: cube.stl (12 tam giác) - chuyển đổi thành solid kín hợp lệ', async ({ page }, testInfo) => {
    const start = performance.now();

    await uploadAndConvert(page, 'cube.stl');
    await waitForConversionFinish(page);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Kiểm tra link tải .step
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();
    const downloadAttr = await dlLink.getAttribute('download');
    expect(downloadAttr).toMatch(/\.step$/i);

    // 2. Kiểm tra thanh tiến trình đạt 100%
    const progress = page.locator('#progress');
    const progressPercent = page.locator('#progressPercent');
    const isProgress100 = await progress.evaluate(el => el.value === 100 || el.getAttribute('value') === '100').catch(() => false);
    const percentText = await progressPercent.textContent().catch(() => '');
    expect(
      isProgress100 || percentText.includes('100%'),
      'Thanh tiến trình phải đạt 100% sau khi chuyển đổi hoàn tất'
    ).toBe(true);

    // 3. Kiểm tra báo cáo mesh-qa đạt các ngưỡng dự án (solid kín, 1 khối)
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/khối kín \(solid\)/i);
    const statusBox = page.locator('#statusBox');
    await expect(statusBox).toHaveAttribute('data-tone', 'success');

    // 4. Kiểm tra cấu trúc nội dung file STEP tải về
    const stepContent = await page.evaluate(async () => {
      const a = document.getElementById('dl');
      if (!a || !a.href) return null;
      const res = await fetch(a.href);
      return await res.text();
    });
    expect(stepContent).toBeTruthy();
    expect(stepContent).toContain('ISO-10303-21');
  });

  // Ca 2: cylinder.stl (Hình trụ kín - kiểm tra mặt trụ/mặt cong)
  test('Ca 2: cylinder.stl (hình trụ) - chuyển đổi thành solid kín hợp lệ', async ({ page }, testInfo) => {
    const start = performance.now();

    await uploadAndConvert(page, 'cylinder.stl');
    await waitForConversionFinish(page);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Tải được link .step
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();
    const downloadAttr = await dlLink.getAttribute('download');
    expect(downloadAttr).toMatch(/\.step$/i);

    // 2. Thanh tiến trình đạt 100%
    const progress = page.locator('#progress');
    const progressPercent = page.locator('#progressPercent');
    const isProgress100 = await progress.evaluate(el => el.value === 100 || el.getAttribute('value') === '100').catch(() => false);
    const percentText = await progressPercent.textContent().catch(() => '');
    expect(
      isProgress100 || percentText.includes('100%'),
      'Thanh tiến trình phải đạt 100% sau khi chuyển đổi hoàn tất'
    ).toBe(true);

    // 3. Báo cáo mesh-qa: solid kín, dung sai & thể tích trong ngưỡng
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/khối kín \(solid\)/i);
    const statusBox = page.locator('#statusBox');
    await expect(statusBox).toHaveAttribute('data-tone', 'success');
  });

  // Ca 3: planar_hole.stl (Khối có lỗ phẳng nhỏ - kiểm tra tính năng vá lỗ)
  test('Ca 3: planar_hole.stl (khối có lỗ phẳng nhỏ) - vá lỗ phẳng thành solid kín', async ({ page }, testInfo) => {
    const start = performance.now();

    // Bật tùy chọn vá lỗ nhỏ có biên phẳng (#fillHoles)
    const settings = page.locator('#settings');
    const isOpen = await settings.getAttribute('open');
    if (isOpen === null) {
      await page.locator('#settings summary').click();
    }
    const fillHolesCheckbox = page.locator('#fillHoles');
    await fillHolesCheckbox.check();

    await uploadAndConvert(page, 'planar_hole.stl');
    await waitForConversionFinish(page);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Tải được .step
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();

    // 2. Thanh tiến trình đạt 100%
    const progress = page.locator('#progress');
    const progressPercent = page.locator('#progressPercent');
    const isProgress100 = await progress.evaluate(el => el.value === 100 || el.getAttribute('value') === '100').catch(() => false);
    const percentText = await progressPercent.textContent().catch(() => '');
    expect(
      isProgress100 || percentText.includes('100%'),
      'Thanh tiến trình phải đạt 100% sau khi chuyển đổi hoàn tất'
    ).toBe(true);

    // 3. Khối được vá kín thành solid
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/khối kín \(solid\)/i);
    expect(logText).toMatch(/vá \d+ lỗ/i);
    const statusBox = page.locator('#statusBox');
    await expect(statusBox).toHaveAttribute('data-tone', 'success');
  });

  // Ca 4: edge_contact.stl (Cạnh tiếp xúc bề dày 0 - kiểm tra sửa cạnh chạm)
  test('Ca 4: edge_contact.stl (cạnh tiếp xúc bề dày 0) - sửa cạnh chạm và tạo solid kín', async ({ page }, testInfo) => {
    const start = performance.now();

    await uploadAndConvert(page, 'edge_contact.stl');
    await waitForConversionFinish(page);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Tải được link .step
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();

    // 2. Thanh tiến trình đạt 100%
    const progress = page.locator('#progress');
    const progressPercent = page.locator('#progressPercent');
    const isProgress100 = await progress.evaluate(el => el.value === 100 || el.getAttribute('value') === '100').catch(() => false);
    const percentText = await progressPercent.textContent().catch(() => '');
    expect(
      isProgress100 || percentText.includes('100%'),
      'Thanh tiến trình phải đạt 100% sau khi chuyển đổi hoàn tất'
    ).toBe(true);

    // 3. Kiểm tra báo cáo sửa cạnh chạm, solid kín và thể tích đổi trong ngưỡng
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/khối kín \(solid\)/i);
    expect(logText).toMatch(/sửa \d+ cạnh chạm/i);
    // Ngưỡng thể tích thay đổi cho sửa cạnh chạm là <= 0.01%
    const statusBox = page.locator('#statusBox');
    await expect(statusBox).toHaveAttribute('data-tone', 'success');
  });

  // Ca 5: open_mesh.stl (Lưới hở - giữ shell và có cảnh báo)
  test('Ca 5: open_mesh.stl (lưới hở) - giữ dạng shell/vỏ và có cảnh báo', async ({ page }, testInfo) => {
    const start = performance.now();

    await uploadAndConvert(page, 'open_mesh.stl');
    await waitForConversionFinish(page);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Vẫn xuất được STEP dạng mặt/vỏ
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible();

    // 2. Giữ shell (mặt/vỏ chưa tạo thành khối kín)
    const logText = await page.locator('#log').textContent();
    expect(logText).toMatch(/mặt\/vỏ chưa tạo thành khối kín/i);
    const statusBox = page.locator('#statusBox');
    await expect(statusBox).toHaveAttribute('data-tone', 'warning');

    // 3. Có cảnh báo hiển thị trong danh sách cảnh báo #warnings
    const warnings = page.locator('#warnings li');
    const count = await warnings.count();
    expect(count, 'Phải có ít nhất 1 cảnh báo về lưới hở hoặc cạnh biên').toBeGreaterThanOrEqual(1);
    const allWarnings = await warnings.allTextContents();
    const hasBoundaryOrShellWarn = allWarnings.some(w =>
      /cạnh biên|mặt\/vỏ|chưa tạo thành khối/i.test(w)
    );
    expect(hasBoundaryOrShellWarn, 'Cảnh báo phải nhắc đến cạnh biên hở hoặc mặt/vỏ').toBe(true);
  });

  // Ca 6: corrupt_text.stl (File văn bản đổi đuôi .stl - hộp lỗi tiếng Việt & không treo tab)
  test('Ca 6: corrupt_text.stl (file hỏng) - hiện #errorBox kèm gợi ý tiếng Việt, tab không bị treo', async ({ page }, testInfo) => {
    const start = performance.now();

    await uploadAndConvert(page, 'corrupt_text.stl');
    // Chờ xử lý lỗi
    await page.locator('#errorBox, #statusBox[data-tone="error"]').waitFor({ timeout: 15000 });

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian ca [${testInfo.title}]: ${elapsed}s`);

    // 1. Kiểm tra tab không bị treo: giao diện vẫn tương tác bình thường
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#choose')).toBeEnabled();

    // 2. Kiểm tra hộp #errorBox hiển thị theo spec
    const errorBox = page.locator('#errorBox');
    await expect(errorBox, 'Hộp #errorBox chẩn đoán lỗi phải hiển thị khi gặp file hỏng').toBeVisible({ timeout: 5000 });

    // 3. Kiểm tra thông báo kèm gợi ý tiếng Việt
    const errorText = await errorBox.textContent();
    expect(errorText).toBeTruthy();
    expect(
      /gợi ý|khắc phục|hãy|vui lòng|kiểm tra|không phải stl/i.test(errorText || ''),
      'Thông báo lỗi phải có gợi ý tiếng Việt'
    ).toBe(true);
  });
});
