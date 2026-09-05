import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test('public homepage uses the secret-motion surface and keeps BEGIN functional', async ({ page }) => {
  await page.goto('/');

  const surface = page.locator('main[data-io-surface="secret-motion"]');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS('background-color', 'rgb(12, 10, 8)');

  const hero = page.locator('#entry-prompt');
  await expect(hero).toHaveCSS('font-weight', '800');
  await expect(hero).toHaveCSS('text-transform', 'uppercase');
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: /BEGIN/i }).first().click();
  await expect(page).toHaveURL(/\/begin$/);
  await expect(page.getByText('01 / 07')).toBeVisible();
  await expect(page.locator('main[data-io-surface="secret-motion"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('reduced motion removes decorative pointer light without removing navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('[data-io-motion="pointer-light"]')).toHaveCSS('display', 'none');
  await expect(page.getByRole('link', { name: /BEGIN/i }).first()).toBeVisible();
});

test('visual QA journey inherits the customer palette without changing the harness', async ({ page }) => {
  await page.goto('/visual-qa/experience');

  const surface = page.locator('main.visual-preview[data-io-surface="secret-motion"]');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS('background-color', 'rgb(12, 10, 8)');
  await expect(page.getByText('VISUAL QA / NOT PRODUCTION')).toBeVisible();
  await expect(page.getByText('01 / 07')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
