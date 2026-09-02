import { test, expect } from '@playwright/test';

test.describe('Product Multi-Unit CRUD', () => {
  test('Admin can create a product with multiple units', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.waitForTimeout(3500); // Wait for bot.guard
    await page.click('button[type="submit"]');
    
    // Ensure we are logged in
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Go to Product Create Page
    await page.goto('/dashboard/products/create');
    await expect(page).toHaveURL(/.*\/dashboard\/products\/create/);

    // 3. Fill Basic Product Info
    // We use explicit selectors to be safe if labels don't have matching 'for' attributes
    const uniqueSku = `TEST-MULTI-${Date.now()}`;
    const productName = `Kopi Sachet ABC ${Date.now()}`;
    
    // Fill SKU
    await page.locator('label:has-text("SKU") + div input').first().fill(uniqueSku);
    
    // Fill Barcode
    await page.getByPlaceholder('Scan atau ketik barcode').fill(uniqueSku);
    
    // Fill Nama Produk
    await page.locator('label:has-text("Nama Produk") + input, label:has-text("Nama Produk") + div input').first().fill(productName);
    
    // Select Category (Headless UI Listbox)
    await page.getByRole('button', { name: 'Pilih kategori' }).click();
    await page.getByRole('option').first().click();

    // Fill Deskripsi
    await page.getByPlaceholder('Deskripsi produk (opsional)').fill('Ini adalah deskripsi untuk pengujian E2E');

    // Fill Prices and Stock
    await page.locator('label:has-text("Harga Beli") + div input').first().fill('1500');
    await page.locator('label:has-text("Harga Jual") + div input').first().fill('2000');
    await page.locator('label:has-text("Stok Awal") + input, label:has-text("Stok Awal") + div input').first().fill('120');

    // 4. Enable Multi-Unit
    // Click the toggle switch
    await page.locator('input[type="checkbox"]').check({ force: true });

    // 5. Add Additional Unit
    const addUnitBtn = page.getByRole('button', { name: /Tambah Satuan/i });
    await expect(addUnitBtn).toBeVisible();
    await addUnitBtn.click();

    // 6. Fill Additional Unit Details
    // The placeholder is "Contoh: 12" for conversion factor
    const conversionInput = page.getByPlaceholder('Contoh: 12');
    await conversionInput.fill('120'); // 1 box = 120 pcs

    const buyPriceInput = page.getByPlaceholder('Rp Beli');
    await buyPriceInput.fill('150000'); // 120 * 1500 = 180000 but we put 150000 for wholesale

    const sellPriceInput = page.getByPlaceholder('Rp Jual');
    await sellPriceInput.fill('200000');

    // 7. Save Product
    const submitBtn = page.getByRole('button', { name: /Simpan Produk/i });
    await submitBtn.click();

    // 8. Verify Success
    // Should redirect back to product list
    await expect(page).toHaveURL(/.*\/dashboard\/products/);
    
    // The new product should be in the table
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });
  });
});
