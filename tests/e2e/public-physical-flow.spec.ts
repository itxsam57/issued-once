import { expect, test } from '@playwright/test';

async function continueText(page: import('@playwright/test').Page, answer: string) {
  await page.getByLabel('Your answer').fill(answer);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function reachPhysicalForm(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /BEGIN/ }).click();
  await continueText(page, 'old maps, storms, strange machines');
  await continueText(page, 'a quiet cabin above a valley');
  await page.getByLabel('4 a.m.').check();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await continueText(page, 'quiet does not mean uncertain');
  await continueText(page, 'a song that feels older than it is');
  await continueText(page, 'literal portraits');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
}

test('public form lock advances only when the server returns real size options', async ({ page }) => {
  await reachPhysicalForm(page);

  await page.getByRole('radio', { name: 'HOODIE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();

  await expect(page.getByText('FORM LOCKED / FIT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the size it should become.' })).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeVisible();
});
