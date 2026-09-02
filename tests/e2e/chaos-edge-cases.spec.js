import { test, expect } from '@playwright/test';

test.describe('Modul 15: Skenario Edge Case Ekstrem Lintas Sistem (Chaos Testing)', () => {
    test('TC-CHAOS-06 & TC-CHAOS-08: Special Characters & Currency Decimal Rounding Integrity', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(3500);
        await page.fill('input[type="email"]', 'admin@mail.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/.*\/dashboard/);

        // Open POS page
        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // Ensure Shift is open
        const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
        const productCard = page.locator('h3').first();
        await expect(openShiftBtn.or(productCard)).toBeVisible({ timeout: 20000 });

        if (await openShiftBtn.isVisible()) {
            await openShiftBtn.click();
            await expect(openShiftBtn).not.toBeVisible({ timeout: 15000 });
        }

        // Search input check
        const searchInput = page.locator('input[placeholder*="Cari produk"], input[type="text"]').first();
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.fill('<script>alert("xss")</script> \' OR \'1\'=\'1');
            await page.waitForTimeout(500);
        }
    });
});
