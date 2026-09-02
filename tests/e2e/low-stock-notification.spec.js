import { test, expect } from '@playwright/test';

test.describe('Low Stock Notification Flow', () => {
  test('System shows notification when a product is below minimum stock', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.waitForTimeout(3500); // Wait for bot.guard
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Go to Product Create Page
    await page.goto('/dashboard/products/create');
    await expect(page).toHaveURL(/.*\/dashboard\/products\/create/);

    // 3. Fill Basic Product Info
    const uniqueSku = `LOW-STOCK-${Date.now()}`;
    const productName = `Produk Tes Notifikasi ${Date.now()}`;
    
    await page.locator('div:has(> label:has-text("SKU")) input').first().fill(uniqueSku);
    await page.getByPlaceholder('Scan atau ketik barcode').fill(uniqueSku);
    await page.locator('div:has(> label:has-text("Nama Produk")) input').first().fill(productName);
    
    // Select Category
    await page.getByRole('button', { name: 'Pilih kategori' }).click();
    await page.getByRole('option').first().click();

    // Fill Deskripsi
    await page.getByPlaceholder('Deskripsi produk (opsional)').fill('Ini adalah deskripsi untuk pengujian E2E Notifikasi');

    // Fill Prices
    await page.locator('div:has(> label:has-text("Harga Beli")) input').first().fill('1000');
    await page.locator('div:has(> label:has-text("Harga Jual")) input').first().fill('1500');
    
    // 4. Fill Low Stock Thresholds (Trigger condition: Stock < Min Stock)
    // Initial Stock = 2 (fill either single stock input or first warehouse stock input)
    const stockInput = page.locator('div:has(> label:has-text("Stok Awal")) input, input[placeholder="0"]').first();
    await stockInput.fill('2');
    
    // Minimum Stock = 5
    const minStockInput = page.locator('div:has(> label:has-text("Stok Minimum")) input').first();
    await minStockInput.fill('5');

    // 5. Save Product
    const submitBtn = page.getByRole('button', { name: /Simpan Produk/i });
    await submitBtn.click();

    // 6. Verify Redirect
    await expect(page).toHaveURL(/\/dashboard\/products$/);
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });

    // Reload page to ensure shared Inertia props fetch the newly created product in lowStockNotifications query
    await page.reload();

    // 7. Verify Notification Bell
    const notifBtn = page.getByRole('button', { name: 'Notifikasi' });
    await expect(notifBtn).toBeVisible();
    await notifBtn.click();

    // Check for notification item in dropdown
    const notifItem = page.getByText(new RegExp(`Stok (menipis|habis): ${productName}`));
    await expect(notifItem).toBeVisible({ timeout: 5000 });
  });
});


