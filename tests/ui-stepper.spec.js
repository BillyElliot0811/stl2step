const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'cube.stl');
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results');

test.describe('Giao diện stl2step: Luồng 3 bước (Stepper) & Nút chế độ xem 3D', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('Kiểm tra thanh Stepper có 3 bước đánh số và chuyển trạng thái theo luồng', async ({ page }) => {
    await page.goto('/');

    // 1. Kiểm tra tồn tại thành phần stepper
    const stepper = page.locator('#stepper');
    await expect(stepper).toBeVisible();

    // 2. Kiểm tra có đủ 3 bước đánh số với đúng nội dung
    const step1 = stepper.locator('[data-step="1"]');
    const step2 = stepper.locator('[data-step="2"]');
    const step3 = stepper.locator('[data-step="3"]');

    await expect(step1).toBeVisible();
    await expect(step2).toBeVisible();
    await expect(step3).toBeVisible();

    // Nội dung văn bản của 3 bước
    await expect(step1).toContainText('1');
    await expect(step1).toContainText('Tải file');

    await expect(step2).toContainText('2');
    await expect(step2).toContainText('Chuyển đổi');

    await expect(step3).toContainText('3');
    await expect(step3).toContainText('Kết quả');

    // Trạng thái ban đầu: Bước 1 là active (aria-current="step" hoặc class active)
    await expect(step1).toHaveAttribute('data-state', 'active');
    await expect(step2).toHaveAttribute('data-state', 'pending');
    await expect(step3).toHaveAttribute('data-state', 'pending');

    // Chụp ảnh trạng thái ban đầu / sẵn sàng tải file
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1-initial.png'), fullPage: true });

    // Tải file STL
    await page.setInputFiles('#file', FIXTURE_PATH);
    const goBtn = page.locator('#go');
    await expect(goBtn).toBeEnabled({ timeout: 10000 });

    // Chụp ảnh bước 1: đã tải file STL
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1-upload.png'), fullPage: true });

    // Bấm nút chuyển sang STEP -> Bước 2 (Chuyển đổi) phải active
    await goBtn.click();

    // Bước 2 chuyển sang active
    await expect(step2).toHaveAttribute('data-state', 'active', { timeout: 5000 });
    await expect(step1).toHaveAttribute('data-state', 'completed');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step2-converting.png'), fullPage: true });

    // Chờ quá trình chuyển đổi hoàn tất (#dl hiển thị)
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible({ timeout: 90000 });

    // Bước 3 chuyển sang active (hoặc completed)
    await expect(step3).toHaveAttribute('data-state', 'active');
    await expect(step2).toHaveAttribute('data-state', 'completed');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3-result.png'), fullPage: true });
  });

  test('Sau khi chuyển cube.stl, kiểm tra nút chuyển giữa 3 chế độ xem đổi trạng thái render thật', async ({ page }) => {
    await page.goto('/');

    // 1. Tải cube.stl và bấm chuyển sang STEP
    await page.setInputFiles('#file', FIXTURE_PATH);
    const goBtn = page.locator('#go');
    await expect(goBtn).toBeEnabled({ timeout: 10000 });
    await goBtn.click();

    // Chờ quá trình chuyển đổi hoàn tất
    const dlLink = page.locator('#dl');
    await expect(dlLink).toBeVisible({ timeout: 90000 });

    const canvas = page.locator('#modelCanvas');
    await expect(canvas).toBeVisible();

    // 3 nút chế độ xem
    const btnBoth = page.locator('#viewBoth');
    const btnSolid = page.locator('#viewSolid');
    const btnWire = page.locator('#viewWire');

    await expect(btnBoth).toBeVisible();
    await expect(btnSolid).toBeVisible();
    await expect(btnWire).toBeVisible();

    await expect(btnBoth).toContainText('Tô bóng có cạnh');
    await expect(btnSolid).toContainText('Tô bóng');
    await expect(btnWire).toContainText('Khung dây');

    // Chế độ 1: Tô bóng có cạnh
    await btnBoth.click();
    await expect(btnBoth).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas).toHaveAttribute('data-render-mode', 'both');
    await page.waitForTimeout(150);
    const imgBoth = await canvas.screenshot();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'view-shaded-edges.png'), imgBoth);

    // Chế độ 2: Chỉ tô bóng
    await btnSolid.click();
    await expect(btnSolid).toHaveAttribute('aria-pressed', 'true');
    await expect(btnBoth).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas).toHaveAttribute('data-render-mode', 'solid');
    await page.waitForTimeout(150);
    const imgSolid = await canvas.screenshot();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'view-shaded.png'), imgSolid);

    // Chế độ 3: Khung dây
    await btnWire.click();
    await expect(btnWire).toHaveAttribute('aria-pressed', 'true');
    await expect(btnSolid).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas).toHaveAttribute('data-render-mode', 'wire');
    await page.waitForTimeout(150);
    const imgWire = await canvas.screenshot();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'view-wireframe.png'), imgWire);

    // Chứng minh render thật thay đổi: cả 3 ảnh chụp canvas phải khác nhau từng cặp
    console.log(`Dung lượng ảnh canvas render thật: both=${imgBoth.length} bytes, solid=${imgSolid.length} bytes, wire=${imgWire.length} bytes`);
    expect(Buffer.compare(imgBoth, imgSolid)).not.toBe(0);
    expect(Buffer.compare(imgBoth, imgWire)).not.toBe(0);
    expect(Buffer.compare(imgSolid, imgWire)).not.toBe(0);
  });
});
