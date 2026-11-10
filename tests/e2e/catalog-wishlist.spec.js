import { test, expect } from '@playwright/test';

test.describe('Catalog Wishlist localStorage Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage before test
        await page.goto('/katalog');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('customer can add product to wishlist and persist in localStorage', async ({ page }) => {
        await page.goto('/katalog');

        // Verify initial wishlist in localStorage is empty
        const initialWishlist = await page.evaluate(() => {
            return localStorage.getItem('pos_catalog_wishlist_v1');
        });
        expect(initialWishlist === null || initialWishlist === '[]').toBeTruthy();

        // Find the first product card's wishlist button
        const firstWishlistBtn = page.locator('button[aria-label*="Wishlist"]').first();
        if (await firstWishlistBtn.count() > 0) {
            await firstWishlistBtn.click();

            // Verify localStorage has 1 item
            const updatedWishlistRaw = await page.evaluate(() => {
                return localStorage.getItem('pos_catalog_wishlist_v1');
            });
            expect(updatedWishlistRaw).not.toBeNull();
            const items = JSON.parse(updatedWishlistRaw);
            expect(items.length).toBe(1);
            expect(items[0]).toHaveProperty('id');
            expect(items[0]).toHaveProperty('title');

            // Open Wishlist Drawer from Navbar
            const navbarWishlistBtn = page.locator('header button[aria-label="Wishlist"]').first();
            await navbarWishlistBtn.click();

            // Verify Wishlist drawer is visible
            const drawerTitle = page.locator('#wishlist-drawer-title');
            await expect(drawerTitle).toBeVisible();

            // Reload page and ensure persistent in localStorage
            await page.reload();
            const reloadedWishlist = await page.evaluate(() => {
                return JSON.parse(localStorage.getItem('pos_catalog_wishlist_v1') || '[]');
            });
            expect(reloadedWishlist.length).toBe(1);
        }
    });
});

