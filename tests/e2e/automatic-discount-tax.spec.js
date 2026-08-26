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
    await page.locator('div:has(> label:has-text("Nama Rule")) >> input').fill(promoName);
    
    // Tipe Diskon (Percentage is default, but let's ensure)
    // Nilai Diskon = 10%
    await page.locator('div:has(> label:has-text("Nilai Diskon")) >> input').fill('10');

    // Save Pricing Rule
    const saveBtn = page.getByRole('button', { name: /Simpan Rule/i });
    await saveBtn.click();
    
    // Wait for success toast and correct URL
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/dashboard\/pricing-rules$/);

    // 3. Go to POS
    await page.goto('/dashboard/transactions');
    await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

    // If shift is closed, open it
    const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
    if (await openShiftBtn.isVisible()) {
        await openShiftBtn.click();
        await page.waitForTimeout(1000);
        const submitShiftBtn = page.getByRole('button', { name: /Simpan|Buka Shift/i }).last();
        if (await submitShiftBtn.isVisible()) {
            await submitShiftBtn.click();
        }
    }

    // 4. Add product to cart
    const firstProduct = page.locator('h3').first();
    await expect(firstProduct).toBeVisible({ timeout: 10000 });
    await firstProduct.click();

    // Verify item added - we check for the text "item" (could be "2 items" if DB state persists)
    await expect(page.getByText(/item/i).first()).toBeVisible();
    
    // 5. Check if Promo and Tax are automatically applied
    // We check the cart summary panel for 'Promo Discount' and 'PPN' text
    // The panel might be collapsible on mobile, but on desktop it's usually visible.
    // If we're on desktop, PaymentPanel should show it.
    
    await expect(page.getByText(/Promo Otomatis/i).first()).toBeVisible({ timeout: 5000 });
    
    // Check Tax (Pajak). It might be labeled as "PPN" or "Tax".
    // In PaymentPanel.jsx we saw "PPN"
    await expect(page.getByText(/PPN/i).first()).toBeVisible();

    // 6. Complete Transaction
    const cashInput = page.locator('input[inputmode="numeric"]').last();
    await expect(cashInput).toBeVisible({ timeout: 5000 });
    await cashInput.fill('1000000'); // Fill large amount

    const checkoutBtn = page.getByRole('button', { name: /Selesaikan Transaksi/i });
    await expect(checkoutBtn).not.toBeDisabled();
    await checkoutBtn.click();

    // 7. Verify Success
    await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 10000 });
  });
});
