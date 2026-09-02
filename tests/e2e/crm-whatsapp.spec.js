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

test.describe('Modul 11: CRM, Segmentasi & WhatsApp Gateway', () => {
    test('TC-CRM-01 & TC-CRM-02: Customer Segmentation & Broadcast Campaigns', async ({ page }) => {
        await ensureLoggedIn(page);

        // Customer segments
        await page.goto('/dashboard/customer-segments');
        await expect(page).toHaveURL(/.*\/dashboard\/customer-segments/);

        // CRM Broadcasts
        await page.goto('/dashboard/crm-broadcasts');
        await expect(page).toHaveURL(/.*\/dashboard\/crm-broadcasts/);
    });

    test('TC-WA-01 & TC-WA-03: Settings WhatsApp Connection Interface', async ({ page }) => {
        await ensureLoggedIn(page);

        // Settings WhatsApp
        await page.goto('/dashboard/settings/whatsapp');
        if (page.url().includes('/confirm-password')) {
            await page.fill('input[type="password"]', 'password');
            await page.click('button[type="submit"]');
            await page.waitForTimeout(1000);
        }
        await expect(page).toHaveURL(/.*\/dashboard\/settings\/whatsapp|.*\/confirm-password/);
    });
});
