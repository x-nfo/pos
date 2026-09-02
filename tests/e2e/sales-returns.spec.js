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

test.describe('Modul 5: Retur Penjualan (Sales Returns)', () => {
    test('TC-RET-01 & TC-RET-02: Sales Returns Module Access & Create Form Interface', async ({ page }) => {
        await ensureLoggedIn(page);

        // Sales Returns index
        await page.goto('/dashboard/sales-returns');
        await expect(page).toHaveURL(/.*\/dashboard\/sales-returns/);

        // Create Sales Return page
        await page.goto('/dashboard/sales-returns/create');
        await expect(page).toHaveURL(/.*\/dashboard\/sales-returns\/create/);
    });
});
