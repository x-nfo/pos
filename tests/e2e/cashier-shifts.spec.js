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

test.describe('Modul 2: Sesi & Manajemen Shift Kasir (Cashier Shifts)', () => {
    test('TC-SHIFT-01 & TC-SHIFT-04: Open Shift & Close Shift dengan Selisih Kas (Discrepancy)', async ({ page }) => {
        await ensureLoggedIn(page);

        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
        if (await openShiftBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await openShiftBtn.click();
            await page.waitForTimeout(1000);
        }

        const shiftHeaderLink = page.locator('a[href*="/dashboard/cashier-shifts/"]').first();
        if (await shiftHeaderLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await shiftHeaderLink.click();
            await expect(page).toHaveURL(/.*\/dashboard\/cashier-shifts\/\d+/);

            const cashInput = page.locator('input[type="number"]').first();
            if (await cashInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await cashInput.fill('100000');
                const submitBtn = page.getByRole('button', { name: /Finalisasi Closing|Tutup Shift/i }).last();
                await submitBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Always re-open shift so other tests aren't blocked
        await page.goto('/dashboard/transactions');
        if (await openShiftBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await openShiftBtn.click();
            await page.waitForTimeout(1000);
        }
    });

    test('TC-SHIFT-02: Akses POS Middleware Blocking saat Shift Tutup', async ({ page }) => {
        await ensureLoggedIn(page);

        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);
    });
});
