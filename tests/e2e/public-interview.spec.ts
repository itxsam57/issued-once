import { expect, test } from '@playwright/test';

test('public answers advance only after the server accepts them and preserve one anonymous session', async ({ page }) => {
  await page.goto('/begin');

  await expect(page.getByText('01 / 07')).toBeVisible();
  await page.getByLabel('Your answer').fill('old maps, weather systems, forgotten machines');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByText('02 / 07')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Where would you disappear for a week if nobody could contact you?' }),
  ).toBeVisible();

  await page.getByLabel('Your answer').fill('a cabin above a foggy valley');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByText('03 / 07')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick a time that feels most like you.' })).toBeVisible();
});
