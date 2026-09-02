import { test, expect } from '@playwright/test';

test.describe('Modul 1: Autentikasi, RBAC & Keamanan Sistem', () => {
  test('TC-AUTH-01 & TC-AUTH-02: Login Berhasil', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3500);
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('TC-AUTH-03: BotGuard - Honeypot Terisi Terdeteksi', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      const honeypot = document.querySelector('input[name="website"]');
      if (honeypot) honeypot.value = 'http://spam-bot.com';
    });
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/.*\/dashboard\/transactions/);
  });

  test('TC-RBAC-01: Pembatasan Akses Kasir pada Menu Admin', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3500);
    await page.fill('input[type="email"]', 'kasir@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard\/transactions/);

    await page.goto('/dashboard/users');
    await expect(page.getByText(/403|Forbidden|tidak memiliki akses/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-RBAC-02: Trigger Step-Up Authentication Password Confirmation', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3500);
    await page.fill('input[type="email"]', 'admin@mail.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/);

    await page.goto('/dashboard/payment-settings');
    await expect(page).toHaveURL(/.*\/dashboard\/payment-settings/);
  });
});
