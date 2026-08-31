import { expect, test } from '@playwright/test';

test('an unresolved payment keeps the buyer on the live Issue polling and recovery surface', async ({ page }) => {
  await page.route('**/api/issue/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ found: false }),
    });
  });

  await page.goto('/payment/pending');

  await expect(page.getByRole('heading', { name: 'Hold this thought.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'FIND MY ISSUE' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ISSUED ONCE' })).toHaveCount(0);
});
