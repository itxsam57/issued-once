import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const forbiddenBeforeClose = /tee|hoodie|hat|product|garment|shop now/i;

async function continueText(page: import('@playwright/test').Page, answer: string) {
  await page.getByLabel('Your answer').fill(answer);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

test('the mystery interview completes in a real browser without leaking the object early', async ({ page }, testInfo) => {
  await page.goto('/__preview__/experience');

  await expect(page.getByText('VISUAL QA / NOT PRODUCTION')).toBeVisible();
  await expect(page.getByText('01 / 07')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Name three things you can talk about for hours.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText(forbiddenBeforeClose);
  await capture(page, `01-q1-${testInfo.project.name}`);

  await continueText(page, 'old maps, weather systems, forgotten machines');
  await expect(page.getByText('02 / 07')).toBeVisible();
  await continueText(page, 'a cabin above a foggy valley');

  await expect(page.getByText('03 / 07')).toBeVisible();
  await page.getByLabel('4 a.m.').check();
  await expect(page.getByLabel('4 a.m.')).toBeChecked();
  await expect(page.locator('body')).not.toContainText(forbiddenBeforeClose);
  await capture(page, `02-q3-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await continueText(page, 'quiet does not mean uncertain');
  await continueText(page, 'a strange old song with too much bass');
  await continueText(page, 'literal portraits');

  await expect(page.getByText('07 / 07')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();
  await expect(page.locator('body')).not.toContainText(forbiddenBeforeClose);
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
  await expect(page.getByText('You decide what it exists on.')).toBeVisible();
  await capture(page, `03-complete-${testInfo.project.name}`);
});

test('the first question fits the viewport without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/__preview__/experience');

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeVisible();
  await capture(page, `04-first-screen-${testInfo.project.name}`);
});
