import { expect, test } from '@playwright/test';

test('public Q1 advances only after the server accepts the answer', async ({ page }) => {
  await page.goto('/begin');

  await expect(page.getByText('01 / 07')).toBeVisible();
  await page.getByLabel('Your answer').fill('old maps, weather systems, forgotten machines');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByText('02 / 07')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Where would you disappear for a week if nobody could contact you?' }),
  ).toBeVisible();
});
