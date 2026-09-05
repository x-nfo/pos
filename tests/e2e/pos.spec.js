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

    // If multi-unit modal opens, pick the first unit option button INSIDE the modal
    const modalUnitOption = page.locator('.animate-fade-in button:has-text("Satuan Dasar"), .animate-fade-in button:has-text("Pilih Satuan")').first();
    if (await modalUnitOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modalUnitOption.click();
        await page.waitForTimeout(500);
    }

    // 5. Wait for item to be added to cart
    await expect(page.locator('text=/Item di Keranjang/i').or(page.getByText(/ditambahkan/i)).first()).toBeVisible({ timeout: 10000 });

    // 6. If Mobile layout (Floating Cart Bar is visible), open cart and proceed to payment sheet
    const floatingCartBtn = page.locator('button:has-text("Keranjang")').last();
    if (await floatingCartBtn.isVisible()) {
        await floatingCartBtn.click();
        await page.waitForTimeout(500);

        const proceedToPayBtn = page.locator('button:has-text("Bayar Sekarang")').first();
        await expect(proceedToPayBtn).toBeVisible({ timeout: 5000 });
        await proceedToPayBtn.click();
        await page.waitForTimeout(500);
    }

    // 7. Select quick cash (Uang Pas or Rp 100.000 or Rp 50.000)
    const quickCashBtn = page.locator('button:has-text("Uang Pas"), button:has-text("Rp 100.000"), button:has-text("Rp 50.000")').first();
    await expect(quickCashBtn).toBeVisible({ timeout: 5000 });
    await quickCashBtn.click();
    await page.waitForTimeout(500);

    // 8. Submit Payment (Desktop: "Selesaikan Transaksi", Mobile: "Bayar Rp...")
    const submitBtn = page.locator('button:has-text("Selesaikan Transaksi"), button:has-text("Bayar Rp")').last();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // 9. Verify Success
    await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 15000 });



  });
});
