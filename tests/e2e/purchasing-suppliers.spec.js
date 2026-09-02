import { test, expect } from '@playwright/test';

async function ensureLoggedIn(page, email = 'admin@mail.com') {
    await page.goto('/dashboard');
    if (page.url().includes('/login')) {
        await page.waitForTimeout(3500);
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/dashboard/);
    }
}

test.describe('Modul 8: Rantai Pembelian (Purchasing, GR & Retur Supplier)', () => {
    test('TC-PUR-01 & TC-PUR-05: Purchase Orders Management & Link Rendering', async ({ page }) => {
        await ensureLoggedIn(page);

        // Navigate to Purchase Orders index
        await page.goto('/dashboard/purchase-orders');
        await expect(page).toHaveURL(/.*\/dashboard\/purchase-orders/);

        // Open create PO page
        await page.goto('/dashboard/purchase-orders/create');
        await expect(page).toHaveURL(/.*\/dashboard\/purchase-orders\/create/);
    });

    test('TC-PUR-02 & TC-SUPRET-01: Goods Receiving & Supplier Returns Interface', async ({ page }) => {
        await ensureLoggedIn(page);

        // Goods Receiving index
        await page.goto('/dashboard/goods-receivings');
        await expect(page).toHaveURL(/.*\/dashboard\/goods-receivings/);

        // Supplier Returns index
        await page.goto('/dashboard/supplier-returns');
        await expect(page).toHaveURL(/.*\/dashboard\/supplier-returns/);
    });
});
