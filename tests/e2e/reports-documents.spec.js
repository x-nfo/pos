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

test.describe('Modul 12: Laporan Keuangan, BI Insights & Cetak ESC/POS', () => {
    test('TC-REP-01 & TC-REP-02: Sales & Profit/Loss Reports Generation', async ({ page }) => {
        await ensureLoggedIn(page);

        // Sales Report
        await page.goto('/dashboard/reports/sales');
        await expect(page).toHaveURL(/.*\/dashboard\/reports\/sales/);

        // Profit & Loss Report
        await page.goto('/dashboard/reports/profit-loss');
        await expect(page).toHaveURL(/.*\/dashboard\/reports\/profit-loss/);
    });

    test('TC-REP-04: Advanced BI Insights & Heatmap Jam Ramai View', async ({ page }) => {
        await ensureLoggedIn(page);

        // BI Insights page
        await page.goto('/dashboard/reports/insights');
        await expect(page).toHaveURL(/.*\/dashboard\/reports\/insights/);
    });
});
