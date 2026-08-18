import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const forbiddenBeforeClose = /\b(?:tee|hoodie|hat|product|garment)\b|shop now/i;
const forbiddenCreativeControl = /\b(?:artwork|design|preview|sample|recommended|palette|style)\b/i;
const forbiddenSizeFear = /\b(?:return|refund|final sale|guaranteed fit|perfect fit)\b/i;
const visualQaPath = '/visual-qa/experience';

async function continueText(page: import('@playwright/test').Page, answer: string) {
  await page.getByLabel('Your answer').fill(answer);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

test('the mystery journey crosses seven private traces and only physical choices without creative control', async ({ page }, testInfo) => {
  await page.goto(visualQaPath);

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
  await expect(page.getByRole('button', { name: 'UNLOCK FORM' })).toBeVisible();
  await capture(page, `03-complete-${testInfo.project.name}`);

  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await expect(page.getByText('FORM / UNLOCKED')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose what it exists on.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'TEE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'HOODIE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'HAT' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const lockForm = page.getByRole('button', { name: 'LOCK FORM' });
  await expect(lockForm).toBeDisabled();
  await page.getByRole('radio', { name: 'HOODIE' }).check();
  await expect(lockForm).toBeEnabled();
  await capture(page, `05-form-${testInfo.project.name}`);
  await lockForm.click();

  await expect(page.getByText('FORM LOCKED / FIT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the size it should become.' })).toBeVisible();
  await expect(page.getByText('Chest 22 in · Length 27 in')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(forbiddenSizeFear);
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const mediumSurface = page.locator('.size-confirmation__option').filter({ hasText: 'Medium' });
  const surfaceMetrics = await mediumSurface.evaluate((element) => {
    const style = getComputedStyle(element);
    const radio = element.querySelector('input');
    const radioStyle = radio ? getComputedStyle(radio) : null;
    return {
      display: style.display,
      height: element.getBoundingClientRect().height,
      radioAppearance: radioStyle?.appearance ?? '',
    };
  });
  expect(['grid', 'flex']).toContain(surfaceMetrics.display);
  expect(surfaceMetrics.height).toBeGreaterThanOrEqual(72);
  expect(surfaceMetrics.radioAppearance).toBe('none');

  const confirmSize = page.getByRole('button', { name: 'CONFIRM SIZE' });
  await expect(confirmSize).toBeDisabled();
  await page.getByRole('radio', { name: /Medium/ }).check();
  await expect(page.getByText('Check this one carefully. This is the size we’ll make.')).toBeVisible();
  await expect(confirmSize).toBeEnabled();
  await capture(page, `06-size-${testInfo.project.name}`);
  await confirmSize.click();

  await expect(page.getByText('FIT LOCKED / BASE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the color it begins as.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Bone' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Black' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Ash' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const boneSurface = page.locator('.base-color__option').filter({ hasText: 'Bone' });
  const baseMetrics = await boneSurface.evaluate((element) => {
    const style = getComputedStyle(element);
    const radio = element.querySelector('input');
    const swatch = element.querySelector('.base-color__swatch');
    const radioStyle = radio ? getComputedStyle(radio) : null;
    const swatchRect = swatch?.getBoundingClientRect();
    return {
      display: style.display,
      height: element.getBoundingClientRect().height,
      radioAppearance: radioStyle?.appearance ?? '',
      swatchWidth: swatchRect?.width ?? 0,
      swatchHeight: swatchRect?.height ?? 0,
    };
  });
  expect(['grid', 'flex']).toContain(baseMetrics.display);
  expect(baseMetrics.height).toBeGreaterThanOrEqual(100);
  expect(baseMetrics.radioAppearance).toBe('none');
  expect(baseMetrics.swatchWidth).toBeGreaterThanOrEqual(40);
  expect(baseMetrics.swatchHeight).toBeGreaterThanOrEqual(40);

  const lockBase = page.getByRole('button', { name: 'LOCK BASE' });
  await expect(lockBase).toBeDisabled();
  await page.getByRole('radio', { name: 'Bone' }).check();
  await expect(lockBase).toBeEnabled();
  await capture(page, `07-base-${testInfo.project.name}`);
  await lockBase.click();
});

test('the first question fits the viewport without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto(visualQaPath);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeVisible();
  await capture(page, `04-first-screen-${testInfo.project.name}`);
});
