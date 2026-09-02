import { test, expect } from '@playwright/test';

test.describe('POS Cart Checkout Flow', () => {
  test('Cashier can add product to cart and checkout', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    
    // 2. Fill in credentials
    await page.fill('input[type="email"]', 'kasir@mail.com');
    await page.fill('input[type="password"]', 'password');
    
    // Wait for bot.guard honeypot timer
    await page.waitForTimeout(3500);
    
    // Click login
    await page.click('button[type="submit"]');
    
    // 3. Navigate to POS Transactions page
    await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

    // Ensure Shift is open
    const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
    const productCard = page.locator('h3').first();
    await expect(openShiftBtn.or(productCard)).toBeVisible({ timeout: 20000 });

    if (await openShiftBtn.isVisible()) {
        await openShiftBtn.click();
        await expect(openShiftBtn).not.toBeVisible({ timeout: 15000 });
    }



    // 4. Wait for products to load and click the first product card
    const firstProduct = page.locator('h3').first();
    await expect(firstProduct).toBeVisible({ timeout: 20000 });
    await firstProduct.click();


    // If multi-unit modal opens, pick the first unit option button
    const unitOption = page.locator('button:has-text("Satuan Dasar"), button:has-text("pcs"), button:has-text("Pilih")').first();
    if (await unitOption.isVisible({ timeout: 2500 }).catch(() => false)) {
        await unitOption.click();
        await page.waitForTimeout(500);
    }

    // Verify item added to cart
    await expect(page.locator('h4, .truncate').first()).toBeVisible({ timeout: 10000 });

    // If cart drawer button is present (mobile/drawer view), click to open cart panel
    const cartDrawerBtn = page.getByRole('button', { name: /Keranjang/i }).first();
    if (await cartDrawerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(cartDrawerBtn).not.toBeDisabled({ timeout: 5000 });
        await cartDrawerBtn.click();
        await page.waitForTimeout(1000);
    }

    // 5. Click "Bayar Sekarang" to open Pembayaran Transaksi modal
    const openPaymentModalBtn = page.getByRole('button', { name: /Bayar Sekarang|Selesaikan Transaksi/i }).first();
    await expect(openPaymentModalBtn).toBeVisible({ timeout: 5000 });
    await openPaymentModalBtn.click();

    // 6. In Payment Modal, click quick cash button "Uang Pas" or "Rp 100.000"
    const quickCashBtn = page.locator('button:has-text("Uang Pas"), button:has-text("Rp 100.000"), button:has-text("Rp 50.000")').first();
    await expect(quickCashBtn).toBeVisible({ timeout: 5000 });
    await quickCashBtn.click();

    // 7. Submit Transaction via modal pay button
    const finalPayBtn = page.locator('button:has-text("Bayar Rp"), button:has-text("Bayar")').last();
    await expect(finalPayBtn).not.toBeDisabled({ timeout: 5000 });
    await finalPayBtn.click();

    // 8. Verify Success
    await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 10000 });



  });
});
