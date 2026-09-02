import { test, expect } from '@playwright/test';

test.describe('Modul 4: Dine-In & Self-Order QR Table System', () => {
    test('TC-DINE-01: Access Dine-In Tables Dashboard Management', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(3500);
        await page.fill('input[type="email"]', 'admin@mail.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/.*\/dashboard/);

        // Navigate to Dine-In tables management
        await page.goto('/dashboard/tables');
        await expect(page).toHaveURL(/.*\/dashboard\/tables/);
    });

    test('TC-DINE-06 & TC-DINE-07: Cashier Orders Queue Interface', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(3500);
        await page.fill('input[type="email"]', 'admin@mail.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        // Check dine-in orders queue page
        await page.goto('/dashboard/dine-in-orders');
        await expect(page).toHaveURL(/.*\/dashboard\/dine-in-orders/);
    });
});
