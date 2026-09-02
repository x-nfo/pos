import { test, expect } from '@playwright/test';

test.describe('Automatic Discount & Tax Flow', () => {
  test('System automatically applies promo discount and tax in POS', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.waitForTimeout(3500); // Wait for bot.guard
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Create Pricing Rule for 10% global discount
    await page.goto('/dashboard/pricing-rules/create');
    await expect(page).toHaveURL(/.*\/dashboard\/pricing-rules\/create/);

    // Fill Nama Rule
    const promoName = `Promo E2E ${Date.now()}`;
    await page.locator('div:has(> label:has-text("Nama Rule")) input').fill(promoName);
    
    // Tipe Diskon (Percentage is default, but let's ensure)
    // Nilai Diskon = 10%
    await page.locator('div:has(> label:has-text("Nilai Diskon")) input').fill('10');

    // Save Pricing Rule
    const saveBtn = page.getByRole('button', { name: /Simpan Rule/i });
    await saveBtn.click();
    
    // Wait for success toast and correct URL
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/dashboard\/pricing-rules$/);

    // 3. Go to POS
    await page.goto('/dashboard/transactions');
    await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

    // Ensure Shift is open
    const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
    const productCard = page.locator('h3').first();
    await expect(openShiftBtn.or(productCard)).toBeVisible({ timeout: 20000 });

    if (await openShiftBtn.isVisible()) {
        await openShiftBtn.click();
        await expect(openShiftBtn).not.toBeVisible({ timeout: 15000 });
    }



    // 4. Add an available (in-stock) product to cart
    const firstProductBtn = page.locator('button:has(h3):not([disabled])').first();
    await expect(firstProductBtn).toBeVisible({ timeout: 20000 });
    await firstProductBtn.click();

    // If multi-unit modal opens, pick the first unit option button
    const unitOption = page.locator('button:has-text("Satuan Dasar"), button:has-text("pcs"), button:has-text("Pilih")').first();
    if (await unitOption.isVisible({ timeout: 2500 }).catch(() => false)) {
        await unitOption.click();
        await page.waitForTimeout(500);
    }

    // Verify item added to cart
    await expect(page.locator('h4, .truncate').first()).toBeVisible({ timeout: 10000 });

    // 5. Check if Promo discount or tax is automatically applied
    await expect(page.getByText(/OFF|Diskon|Promo|PPN/i).first()).toBeVisible({ timeout: 5000 });

    // 6. Select quick cash amount (e.g., Rp 100.000 or Rp 50.000)
    const quickCashBtn = page.locator('button:has-text("Rp 100.000"), button:has-text("Rp 50.000"), button:has-text("Rp 20.000")').first();
    if (await quickCashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quickCashBtn.click();
    }

    // 7. Submit Transaction via Selesaikan Transaksi button
    const finalPayBtn = page.getByRole('button', { name: /Selesaikan Transaksi|Bayar/i }).first();
    await expect(finalPayBtn).not.toBeDisabled({ timeout: 5000 });
    await finalPayBtn.click();

    // 8. Verify Success
    await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 10000 });


  });
});


