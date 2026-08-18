import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

async function continueText(
  page: import('@playwright/test').Page,
  answer: string,
  nextProgress: string,
) {
  await page.getByLabel('Your answer').fill(answer);
  const continueButton = page.getByRole('button', { name: 'CONTINUE' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByText(nextProgress)).toBeVisible();
}

async function reachPhysicalForm(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /BEGIN/ }).click();
  await expect(page.getByText('01 / 07')).toBeVisible();

  await continueText(page, 'old maps, storms, strange machines', '02 / 07');
  await continueText(page, 'a quiet cabin above a valley', '03 / 07');
  await page.getByLabel('4 a.m.').check();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.getByText('04 / 07')).toBeVisible();
  await continueText(page, 'quiet does not mean uncertain', '05 / 07');
  await continueText(page, 'a song that feels older than it is', '06 / 07');
  await continueText(page, 'literal portraits', '07 / 07');

  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await expect(page.getByText('FORM / UNLOCKED')).toBeVisible();
}

test('public physical flow reaches provider-backed fit and base facts', async ({ page }, testInfo) => {
  await reachPhysicalForm(page);

  await page.getByRole('radio', { name: 'HOODIE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();

  await expect(page.getByText('FORM LOCKED / FIT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the size it should become.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'M' })).toBeVisible();
  await capture(page, `12-public-fit-${testInfo.project.name}`);

  await page.getByRole('radio', { name: 'M' }).check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();

  await expect(page.getByText('FIT LOCKED / BASE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the color it begins as.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Bone' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Black' })).toBeVisible();
  await capture(page, `13-public-base-${testInfo.project.name}`);
});
