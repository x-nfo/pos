import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('Admin can login successfully', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    


    // Fill in credentials
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    
    // Wait for bot.guard honeypot timer (usually 3 seconds)
    await page.waitForTimeout(3500);
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Verify successful login
    await expect(page).toHaveURL(/.*\/dashboard.*/);
  });
});
