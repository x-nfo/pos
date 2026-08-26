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
    
    // 3. Navigate to POS Transactions page (usually redirects here automatically, but ensure we are there)
    await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

    // If shift is closed, we need to open it.
    // Check if "Buka Shift Sekarang" button is visible
    const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
    if (await openShiftBtn.isVisible()) {
        await openShiftBtn.click();
        // Wait for modal and confirm
        await page.waitForTimeout(1000);
        // Assuming there is a "Simpan" or "Buka Shift" button in the modal
        const submitShiftBtn = page.getByRole('button', { name: /Simpan|Buka Shift/i }).last();
        if (await submitShiftBtn.isVisible()) {
            await submitShiftBtn.click();
        }
    }

    // 4. Wait for products to load and click the first product
    // We target the h3 element inside the ProductGrid which contains the product title
    const firstProduct = page.locator('h3').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();

    // 5. Verify the product was added to the cart
    // The cart header should show "1 item" and Subtotal should appear
    await expect(page.getByText('1 item')).toBeVisible();
    await expect(page.getByText('Subtotal')).toBeVisible();

    // 6. Input Cash Amount
    // Target the cash input field (inputMode="numeric")
    const cashInput = page.locator('input[inputmode="numeric"]').last();
    await cashInput.fill('1000000'); // Fill 1,000,000 to ensure it covers any total

    // 7. Submit Transaction
    const checkoutBtn = page.getByRole('button', { name: /Selesaikan Transaksi/i });
    await expect(checkoutBtn).not.toBeDisabled();
    await checkoutBtn.click();

    // 8. Verify Success (Print modal or redirect)
    // After success, it usually shows a success toast or a receipt/print button
    await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 10000 });
  });
});
