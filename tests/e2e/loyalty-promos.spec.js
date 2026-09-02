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

test.describe('Modul 10: Skema Harga, Diskon, Voucher & Loyalty', () => {
    test('TC-LOY-01 & TC-LOY-02: Customer Loyalty Tiers & Points Management', async ({ page }) => {
        await ensureLoggedIn(page);

        // Loyalty tiers / settings
        await page.goto('/dashboard/loyalty-tiers');
        await expect(page).toHaveURL(/.*\/dashboard\/loyalty-tiers/);
    });

    test('TC-PRICELIST-01 & TC-PRICELIST-02: Price Lists & Pricing Rules', async ({ page }) => {
        await ensureLoggedIn(page);

        // Pricing rules index
        await page.goto('/dashboard/pricing-rules');
        await expect(page).toHaveURL(/.*\/dashboard\/pricing-rules/);

        // Price lists index
        await page.goto('/dashboard/price-lists');
        await expect(page).toHaveURL(/.*\/dashboard\/price-lists/);
    });
});
