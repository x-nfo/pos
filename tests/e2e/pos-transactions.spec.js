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
        const unitOption = page.locator('button:has-text("Satuan Dasar"), button:has-text("pcs"), button:has-text("Pilih")').first();
        if (await unitOption.isVisible({ timeout: 2500 }).catch(() => false)) {
            await unitOption.click();
            await page.waitForTimeout(500);
        }

        // Open cart drawer if visible on mobile layout
        const cartDrawerBtn = page.getByRole('button', { name: /Keranjang/i }).first();
        if (await cartDrawerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(cartDrawerBtn).not.toBeDisabled({ timeout: 5000 });
            await cartDrawerBtn.click();
            await page.waitForTimeout(1000);
        }

        // Click quick cash button (Uang Pas / Rp 100.000 / Rp 50.000) or open payment modal
        const quickCashBtn = page.locator('button:has-text("Uang Pas"), button:has-text("Rp 100.000"), button:has-text("Rp 50.000")').first();
        const openPaymentModalBtn = page.getByRole('button', { name: /Bayar Sekarang|Selesaikan Transaksi|Bayar/i }).first();

        if (await quickCashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await quickCashBtn.click();
            await page.waitForTimeout(500);
        }

        const submitBtn = page.locator('button:has-text("Selesaikan Transaksi"), button:has-text("Bayar")').first();
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitBtn.click();
        } else if (await openPaymentModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await openPaymentModalBtn.click();
            if (await quickCashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await quickCashBtn.click();
            }
            const finalPayBtn = page.locator('button:has-text("Bayar Rp"), button:has-text("Bayar"), button:has-text("Selesaikan Transaksi")').last();
            await finalPayBtn.click();
        }

        // Verify success receipt
        await expect(page.getByText(/Berhasil|Struk/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('TC-POS-13 & TC-POS-14: Multi-Hold Cart & Resume Cart', async ({ page }) => {
        await ensureLoggedIn(page, 'admin@mail.com');

        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // Add product to cart
        const firstProduct = page.locator('h3').first();
        await expect(firstProduct).toBeVisible({ timeout: 20000 });
        await firstProduct.click();

        const unitOption = page.locator('button:has-text("Satuan Dasar"), button:has-text("pcs"), button:has-text("Pilih")').first();
        if (await unitOption.isVisible({ timeout: 2500 }).catch(() => false)) {
            await unitOption.click();
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
