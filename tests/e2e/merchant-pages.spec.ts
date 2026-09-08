import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

const merchantRoutes = [
  { path: '/store-info', heading: 'What you are actually buying.' },
  { path: '/contact', heading: 'If something needs sorting, bring the Issue Code.' },
  { path: '/terms', heading: 'The physical facts are known. The interpretation is not.' },
  { path: '/returns', heading: 'Personalized does not mean remedy-free.' },
] as const;

test('public merchant routes are readable, linked, and do not overflow the viewport', async ({ page }, testInfo) => {
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  for (const label of ['STORE INFO', 'CONTACT', 'TERMS', 'RETURNS']) {
    await expect(footer.getByRole('link', { name: label })).toBeVisible();
  }

  for (const route of merchantRoutes) {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Merchant information' })).toBeVisible();
    await capture(page, `27-merchant-${route.path.slice(1)}-${testInfo.project.name}`);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const publicText = await page.locator('body').innerText();
    expect(publicText).not.toMatch(/Delaware|United Kingdom office|US corporation/i);
  }
});
