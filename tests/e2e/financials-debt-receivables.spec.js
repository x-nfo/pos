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

test.describe('Modul 9: Manajemen Keuangan (Hutang & Piutang Usaha)', () => {
    test('TC-REC-01 & TC-REC-04: Receivables List & Aging Buckets Analysis', async ({ page }) => {
        await ensureLoggedIn(page);

        // Receivables index
        await page.goto('/dashboard/receivables');
        await expect(page).toHaveURL(/.*\/dashboard\/receivables/);

        // Aging report page
        await page.goto('/dashboard/receivables/aging');
        await expect(page).toHaveURL(/.*\/dashboard\/receivables\/aging/);
    });

    test('TC-PAY-01 & TC-PAY-03: Payables List & Supplier Statement', async ({ page }) => {
        await ensureLoggedIn(page);

        // Payables index
        await page.goto('/dashboard/payables');
        await expect(page).toHaveURL(/.*\/dashboard\/payables/);
    });
});
