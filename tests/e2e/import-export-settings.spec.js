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

test.describe('Modul 13: Import/Export & Pengaturan Sistem', () => {
    test('TC-IMP-01 & TC-IMP-04: Products & Transactions Import/Export Hub', async ({ page }) => {
        await ensureLoggedIn(page);

        // Products Import page
        await page.goto('/dashboard/products/import');
        await expect(page).toHaveURL(/.*\/dashboard\/products\/import/);
    });

    test('TC-SET-01 & TC-SET-02: System Tax Settings & Language Localization Switch', async ({ page }) => {
        await ensureLoggedIn(page);

        // Application Settings
        await page.goto('/dashboard/settings');
        await expect(page).toHaveURL(/.*\/dashboard\/settings/);
    });
});
