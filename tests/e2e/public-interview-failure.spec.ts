import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('a failed answer save keeps the answer and offers a calm retry', async ({ page }, testInfo) => {
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
  const status = page.getByRole('status');
  await expect(status).toHaveText('NOT SAVED / TRY AGAIN');
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();

  const metrics = await status.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      background: style.backgroundColor,
      fontSize: Number.parseFloat(style.fontSize),
      letterSpacing: Number.parseFloat(style.letterSpacing),
    };
  });
  expect(metrics.color).toBe('rgb(122, 41, 37)');
  expect(metrics.background).toBe('rgba(0, 0, 0, 0)');
  expect(metrics.fontSize).toBeLessThanOrEqual(11);
  expect(metrics.letterSpacing).toBeGreaterThanOrEqual(1.5);

  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({
    path: `artifacts/visual/10-save-recovery-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
