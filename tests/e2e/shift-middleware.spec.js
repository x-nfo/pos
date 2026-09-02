import { test, expect } from '@playwright/test';

test.describe('Shift Middleware Validation', () => {
    test('System blocks POS transactions when shift is closed', async ({ page }) => {
        // 1. Login as Admin (admin@mail.com has cashier-shifts-access permission)
        await page.goto('/login');
        await page.waitForTimeout(3500); // Wait for BotGuard honeypot
        await page.fill('input[type="email"]', 'admin@mail.com');
        await page.fill('input[type="password"]', 'password');
        await page.locator('button[type="submit"]').click();


        // Ensure we are logged in
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // 2. Click active shift indicator link in POS header to open shift details
        const shiftHeaderLink = page.locator('a[href*="/dashboard/cashier-shifts/"]').first();
        await expect(shiftHeaderLink).toBeVisible({ timeout: 5000 });
        await shiftHeaderLink.click();
        await expect(page).toHaveURL(/.*\/dashboard\/cashier-shifts\/\d+/);

        // Fill cash input and submit close shift form
        const cashInput = page.locator('input[type="number"]').first();
        await expect(cashInput).toBeVisible({ timeout: 5000 });
        await cashInput.fill('0');
        const submitBtn = page.getByRole('button', { name: /Finalisasi Closing|Tutup Shift/i }).last();
        await submitBtn.click();
        await page.waitForTimeout(2000);



        // 3. Navigate back to POS Transactions page where shift is now closed
        await page.goto('/dashboard/transactions');
        await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

        // 4. Try to bypass middleware by directly hitting the POS API using in-page axios
        // Include Accept: application/json header so Laravel middleware returns HTTP 422
        const { status } = await page.evaluate(async () => {
            try {
                const response = await window.axios.post('/dashboard/transactions/addToCart', {
                    product_id: 1,
                    qty: 1
                }, {
                    headers: { 'Accept': 'application/json' }
                });
                return { status: response.status };
            } catch (error) {
                return { status: error.response?.status };
            }
        });

        // The middleware EnsureActiveCashierShift should block this and return 422
        expect(status).toBe(422);


        // 5. Verify the UI also blocks interaction (shows open shift screen/button)
        await page.goto('/dashboard/transactions');
        const openShiftAgainBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
        await expect(openShiftAgainBtn).toBeVisible({ timeout: 10000 });

        // Re-open shift so subsequent test suites can run cleanly
        await openShiftAgainBtn.click();
        await page.waitForTimeout(2000);
    });
});


