import { test, expect } from '@playwright/test';

test.describe('Shift Middleware Validation', () => {
    test('System blocks POS transactions when shift is closed', async ({ page }) => {
        // 1. Login as Kasir
        await page.goto('/login');
        await page.waitForTimeout(3500); // Wait for BotGuard honeypot
        await page.fill('input[type="email"]', 'kasir@mail.com');
        await page.fill('input[type="password"]', 'password');
        await page.locator('button[type="submit"]').click();

        // Ensure we are logged in
        await expect(page).toHaveURL(/.*\/dashboard\/transactions$/);

        // 2. Open shift if it's currently closed
        const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
        if (await openShiftBtn.isVisible()) {
            await openShiftBtn.click();
            await page.waitForTimeout(1000);
            const submitShiftBtn = page.getByRole('button', { name: /Simpan|Buka Shift/i }).last();
            if (await submitShiftBtn.isVisible()) {
                await submitShiftBtn.click();
                await page.waitForTimeout(1000); // Wait for submission
            }
        }

        // Wait for Shift Aktif badge in POS
        await expect(page.getByText(/Shift aktif/i)).toBeVisible({ timeout: 10000 });

        // 3. Close the shift
        await page.getByText(/Shift aktif/i).click();
        
        // We are now on cashier-shifts.show page
        await expect(page).toHaveURL(/.*\/dashboard\/cashier-shifts\/\d+/);
        
        // Fill Kas Fisik Aktual
        await page.locator('input[type="number"]').fill('0');
        
        const confirmCloseBtn = page.getByRole('button', { name: /Finalisasi Closing/i });
        await confirmCloseBtn.click();

        // Wait for success
        await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 10000 });

        // 4. Try to bypass middleware by directly hitting the POS API using in-page axios
        // This ensures CSRF tokens and session cookies are perfectly attached
        const { status, message } = await page.evaluate(async () => {
            try {
                const response = await window.axios.post('/dashboard/transactions/addToCart', {
                    product_id: 1,
                    quantity: 1
                });
                return { status: response.status, message: response.data.message };
            } catch (error) {
                return { status: error.response.status, message: error.response.data.message };
            }
        });

        // The middleware EnsureActiveCashierShift should block this and return 422
        expect(status).toBe(422);
        expect(message).toMatch(/Shift kasir belum dibuka/i);

        // 5. Verify the UI also blocks interaction (shows modal)
        await page.goto('/dashboard/transactions');
        await expect(page.getByRole('button', { name: /Buka Shift Sekarang/i })).toBeVisible();
    });
});
