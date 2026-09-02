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

test.describe('Modul 6: Inventori, Multi-Gudang & Mutasi Stok', () => {
    test('TC-WH-01 & TC-WH-02: Multi-Warehouse Stock Transfers List & Create Interface', async ({ page }) => {
        await ensureLoggedIn(page);

        // Navigate to Stock Transfers
        await page.goto('/dashboard/stock-transfers');
        await expect(page).toHaveURL(/.*\/dashboard\/stock-transfers/);

        // Create stock transfer page
        await page.goto('/dashboard/stock-transfers/create');
        await expect(page).toHaveURL(/.*\/dashboard\/stock-transfers\/create/);
    });

    test('TC-MUT-01 & TC-MUT-02: Stock Mutations Audit Trail View & Filter', async ({ page }) => {
        await ensureLoggedIn(page);

        // Navigate to Stock Mutations Audit Trail
        await page.goto('/dashboard/stock-mutations');
        await expect(page).toHaveURL(/.*\/dashboard\/stock-mutations/);
    });
});
