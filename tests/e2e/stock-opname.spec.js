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

test.describe('Modul 7: Stock Opname & Penyesuaian Stok', () => {
    test('TC-OPN-01 & TC-OPN-05: Stock Opname Index & Create Session Interface', async ({ page }) => {
        await ensureLoggedIn(page);

        // Navigate to Stock Opnames index
        await page.goto('/dashboard/stock-opnames');
        await expect(page).toHaveURL(/.*\/dashboard\/stock-opnames/);

        // Create stock opname page
        await page.goto('/dashboard/stock-opnames/create');
        await expect(page).toHaveURL(/.*\/dashboard\/stock-opnames\/create/);
    });
});
