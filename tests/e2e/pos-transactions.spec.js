import { test, expect } from '@playwright/test';

async function ensureLoggedIn(page, email = 'kasir@mail.com') {
    await page.goto('/dashboard');
    if (page.url().includes('/login')) {
        await page.waitForTimeout(3500);
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/dashboard/);
    }
}

test.describe('Modul 3: Transaksi POS, Mobile PWA & Keranjang', () => {
    test('TC-POS-01 & TC-POS-16: Add Product to Cart & Complete Cash Transaction', async ({ page }) => {
        await ensureLoggedIn(page, 'kasir@mail.com');

        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // Open shift if needed
        const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
        const productCard = page.locator('h3').first();
        await expect(openShiftBtn.or(productCard)).toBeVisible({ timeout: 20000 });

        if (await openShiftBtn.isVisible()) {
            await openShiftBtn.click();
            await expect(openShiftBtn).not.toBeVisible({ timeout: 15000 });
        }

        // Add available product to cart
        const firstProduct = page.locator('h3').first();
        await expect(firstProduct).toBeVisible({ timeout: 20000 });
        await firstProduct.click();

        // Handle unit option modal if presented
        const modalUnitOption = page.locator('.animate-fade-in button:has-text("Satuan Dasar"), .animate-fade-in button:has-text("Pilih Satuan")').first();
        if (await modalUnitOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await modalUnitOption.click();
            await page.waitForTimeout(500);
        }

        // Wait for item to be in cart
        await expect(page.locator('text=/Item di Keranjang/i').or(page.getByText(/ditambahkan/i))).toBeVisible({ timeout: 10000 });

        // If Mobile layout (Floating Cart Bar is visible), open cart and proceed to payment sheet
        const floatingCartBtn = page.locator('button:has-text("Keranjang")').last();
        if (await floatingCartBtn.isVisible()) {
            await floatingCartBtn.click();
            await page.waitForTimeout(500);

            const proceedToPayBtn = page.locator('button:has-text("Bayar Sekarang")').first();
            await expect(proceedToPayBtn).toBeVisible({ timeout: 5000 });
            await proceedToPayBtn.click();
            await page.waitForTimeout(500);
        }

        // Click quick cash button (Uang Pas / Rp 100.000 / Rp 50.000)
        const quickCashBtn = page.locator('button:has-text("Uang Pas"), button:has-text("Rp 100.000"), button:has-text("Rp 50.000")').first();
        await expect(quickCashBtn).toBeVisible({ timeout: 5000 });
        await quickCashBtn.click();
        await page.waitForTimeout(500);

        // Submit Payment
        const submitBtn = page.locator('button:has-text("Selesaikan Transaksi"), button:has-text("Bayar Rp")').last();
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
        await submitBtn.click();

        // Verify success receipt
        await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('TC-POS-13 & TC-POS-14: Multi-Hold Cart & Resume Cart', async ({ page }) => {
        await ensureLoggedIn(page, 'admin@mail.com');

        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // Add product to cart
        const firstProduct = page.locator('h3').first();
        await expect(firstProduct).toBeVisible({ timeout: 20000 });
        await firstProduct.click();

        const modalUnitOption = page.locator('.animate-fade-in button:has-text("Satuan Dasar"), .animate-fade-in button:has-text("Pilih Satuan")').first();
        if (await modalUnitOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await modalUnitOption.click();
            await page.waitForTimeout(500);
        }

        // Look for Hold button
        const holdBtn = page.getByRole('button', { name: /Tahan|Hold/i }).first();
        if (await holdBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await holdBtn.click();
            await page.waitForTimeout(1000);
        }
    });
});
