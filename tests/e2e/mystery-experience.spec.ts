import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const forbiddenBeforeClose = /\b(?:tee|hoodie|hat|cap|tote|product|garment)\b|shop now/i;
const forbiddenCreativeControl = /\b(?:artwork|design|preview|sample|recommended|palette|style)\b/i;
const forbiddenSizeFear = /\b(?:return|refund|final sale|guaranteed fit|perfect fit)\b/i;
const forbiddenCommitmentPressure = /\b(?:countdown|sold out|only\s+\d+\s+left|people are viewing|limited time|hurry|ending soon|return|refund|final sale)\b/i;
const visualQaPath = '/visual-qa/experience';

async function continueText(
  page: import('@playwright/test').Page,
  answer: string,
  nextProgress?: string,
) {
  await page.getByLabel('Your answer').fill(answer);
  const continueButton = page.getByRole('button', { name: 'CONTINUE' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  if (nextProgress) await expect(page.getByText(nextProgress)).toBeVisible();
}

async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

async function completePreviewIdentity(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: 'Where do we find you?' })).toBeVisible();
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByRole('button', { name: 'SEND CODE' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'VERIFY' }).click();
  await expect(page.getByRole('heading', { name: 'Where does it go?' })).toBeVisible();
  await page.getByLabel('Name').fill('QA Customer');
  await page.getByLabel('Address').fill('1 QA Street');
  await page.getByLabel('City').fill('Peshawar');
  await page.getByLabel('Postal code').fill('25000');
  await page.getByLabel('Country').selectOption('PK');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();
}

test('the mystery journey crosses private traces, physical locks, identity, destination, and commitment without pressure', async ({ page }, testInfo) => {
  await page.goto(visualQaPath);

  await expect(page.getByText('VISUAL QA / NOT PRODUCTION')).toBeVisible();
  await expect(page.getByText('01 / 07')).toBeVisible();
  await expect(page.getByRole('heading', { name: "So tell me. What's your favourite book?" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText(forbiddenBeforeClose);
  await capture(page, `01-q1-${testInfo.project.name}`);

  await continueText(page, 'The Master and Margarita');
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
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();

  await expect(page.getByText('FORM / CURRENT ISSUE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick the shape your issue lives on.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'TEE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'CAP' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'TOTE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'HOODIE' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const lockForm = page.getByRole('button', { name: 'LOCK FORM' });
  await expect(lockForm).toBeDisabled();
  await page.getByRole('radio', { name: 'TEE' }).check();
  await expect(lockForm).toBeEnabled();
  await capture(page, `05-form-${testInfo.project.name}`);
  await lockForm.click();

  await expect(page.getByText('FORM LOCKED / FIT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick your size.' })).toBeVisible();
  for (const size of ['Extra small', 'Small', 'Medium', 'Large', 'Extra large', '2X large']) {
    await expect(page.getByRole('radio', { name: new RegExp(`^${size}`) })).toBeVisible();
  }
  await expect(page.getByText('Chest 20 in · Length 29 in')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(forbiddenSizeFear);
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const mediumSurface = page.locator('.size-confirmation__option').filter({ hasText: 'Medium' });
  const surfaceMetrics = await mediumSurface.evaluate((element) => ({
    display: getComputedStyle(element).display,
    height: element.getBoundingClientRect().height,
  }));
  expect(['grid', 'flex']).toContain(surfaceMetrics.display);
  expect(surfaceMetrics.height).toBeGreaterThanOrEqual(72);

  const confirmSize = page.getByRole('button', { name: 'CONFIRM SIZE' });
  await expect(confirmSize).toBeDisabled();
  await page.getByRole('radio', { name: /^Medium/ }).check();
  await expect(page.getByText('Chest 20 in · Length 29 in')).toBeVisible();
  await expect(page.getByText('Check this one carefully. This is the size we’ll make.')).toBeVisible();
  await expect(confirmSize).toBeEnabled();
  await capture(page, `06-size-${testInfo.project.name}`);
  await confirmSize.click();

  await expect(page.getByText('FIT LOCKED / BASE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Color your issue.' })).toBeVisible();
  for (const color of ['Bone', 'Black', 'Ash', 'Navy', 'Forest']) {
    await expect(page.getByRole('radio', { name: color })).toBeVisible();
  }
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const boneSurface = page.locator('.base-color__option').filter({ hasText: 'Bone' });
  const baseMetrics = await boneSurface.evaluate((element) => {
    const swatch = element.querySelector('.base-color__swatch');
    const swatchRect = swatch?.getBoundingClientRect();
    return {
      display: getComputedStyle(element).display,
      height: element.getBoundingClientRect().height,
      swatchWidth: swatchRect?.width ?? 0,
      swatchHeight: swatchRect?.height ?? 0,
    };
  });
  expect(['grid', 'flex']).toContain(baseMetrics.display);
  expect(baseMetrics.height).toBeGreaterThanOrEqual(88);
  expect(baseMetrics.swatchWidth).toBeGreaterThanOrEqual(24);
  expect(baseMetrics.swatchHeight).toBeGreaterThanOrEqual(24);

  const lockBase = page.getByRole('button', { name: 'LOCK BASE' });
  await expect(lockBase).toBeDisabled();
  await page.getByRole('radio', { name: 'Bone' }).check();
  await expect(lockBase).toBeEnabled();
  await capture(page, `07-base-${testInfo.project.name}`);
  await lockBase.click();

  await completePreviewIdentity(page);
  await expect(page.getByText('FORM COMPLETE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeVisible();
  await expect(page.getByText('TEE / M / BONE')).toBeVisible();
  await expect(page.getByText('$54.00')).toBeVisible();
  await expect(page.getByText('Everything else stays unknown until it arrives.')).toBeVisible();
  const issueMine = page.getByRole('button', { name: 'ISSUE MINE' });
  await expect(issueMine).toBeVisible();
  await expect(page.locator('body')).not.toContainText(forbiddenCommitmentPressure);
  await expect(page.locator('body')).not.toContainText(forbiddenCreativeControl);

  const commitmentMetrics = await page.locator('.commitment').evaluate((element) => {
    const ledger = element.querySelector('.commitment__ledger');
    const price = element.querySelector('.commitment__price');
    const button = element.querySelector('button');
    const ledgerStyle = ledger ? getComputedStyle(ledger) : null;
    const priceStyle = price ? getComputedStyle(price) : null;
    const buttonStyle = button ? getComputedStyle(button) : null;
    return {
      ledgerDisplay: ledgerStyle?.display ?? '',
      ledgerHeight: ledger?.getBoundingClientRect().height ?? 0,
      priceFontSize: Number.parseFloat(priceStyle?.fontSize ?? '0'),
      buttonHeight: button?.getBoundingClientRect().height ?? 0,
      buttonBackground: buttonStyle?.backgroundColor ?? '',
      buttonBorderTop: Number.parseFloat(buttonStyle?.borderTopWidth ?? '0'),
    };
  });
  expect(['grid', 'flex']).toContain(commitmentMetrics.ledgerDisplay);
  expect(commitmentMetrics.ledgerHeight).toBeGreaterThanOrEqual(96);
  expect(commitmentMetrics.priceFontSize).toBeGreaterThanOrEqual(36);
  expect(commitmentMetrics.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(commitmentMetrics.buttonBackground).toBe('rgba(0, 0, 0, 0)');
  expect(commitmentMetrics.buttonBorderTop).toBe(0);

  await capture(page, `08-commitment-${testInfo.project.name}`);
  await issueMine.click();
  await expect(page.getByRole('heading', { name: 'PREVIEW COMPLETE.' })).toBeVisible();
  await expect(page.getByText('No payment was attempted.')).toBeVisible();
  await capture(page, `11-preview-complete-${testInfo.project.name}`);
});

test('the first question fits the viewport without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto(visualQaPath);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeVisible();
  await capture(page, `04-first-screen-${testInfo.project.name}`);
});

test('the public BEGIN link opens the first mystery question without category leakage', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A piece of your mind. Issued for you.' })).toBeVisible();
  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await expect(page).toHaveURL(/\/begin$/);
  await expect(page.getByText('01 / 07')).toBeVisible();
  await expect(page.getByRole('heading', { name: "So tell me. What's your favourite book?" })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(forbiddenBeforeClose);
  await capture(page, `09-public-entry-${testInfo.project.name}`);
});

test('the real public seven-answer path can unlock the current issue instead of ending in a dead end', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await expect(page.getByText('01 / 07')).toBeVisible();
  await continueText(page, 'The Master and Margarita', '02 / 07');
  await continueText(page, 'a quiet cabin above a valley', '03 / 07');
  await page.getByLabel('4 a.m.').check();
  const q3Continue = page.getByRole('button', { name: 'CONTINUE' });
  await expect(q3Continue).toBeEnabled();
  await q3Continue.click();
  await expect(page.getByText('04 / 07')).toBeVisible();
  await continueText(page, 'quiet does not mean uncertain', '05 / 07');
  await continueText(page, 'a song that feels older than it is', '06 / 07');
  await continueText(page, 'literal portraits', '07 / 07');
  const finalContinue = page.getByRole('button', { name: 'CONTINUE' });
  await expect(finalContinue).toBeEnabled();
  await finalContinue.click();
  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
  const unlockForm = page.getByRole('button', { name: 'UNLOCK FORM' });
  await expect(unlockForm).toBeVisible();
  await unlockForm.click();
  await expect(page.getByText('FORM / CURRENT ISSUE')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'TEE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'CAP' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'TOTE' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'HOODIE' })).toHaveCount(0);
  await capture(page, `12-public-form-${testInfo.project.name}`);
});
