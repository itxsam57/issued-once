import { expect, test } from '@playwright/test';

test('a failed answer save keeps the answer and offers a calm retry', async ({ page }) => {
  await page.route('**/api/experience/answer', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Interview storage is unavailable' }),
    });
  });

  await page.goto('/begin');
  const answer = page.getByLabel('Your answer');
  await answer.fill('old maps, weather systems, forgotten machines');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByText('01 / 07')).toBeVisible();
  await expect(answer).toHaveValue('old maps, weather systems, forgotten machines');
  await expect(page.getByRole('status')).toHaveText('NOT SAVED / TRY AGAIN');
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();
});
