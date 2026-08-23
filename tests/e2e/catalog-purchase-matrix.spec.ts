import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type MatrixObject = {
  key: 'tee' | 'hat' | 'tote';
  radio: 'TEE' | 'CAP' | 'TOTE';
  size: RegExp;
  color: 'Bone';
};

const MATRIX: MatrixObject[] = [
  { key: 'tee', radio: 'TEE', size: /^Medium/, color: 'Bone' },
  { key: 'hat', radio: 'CAP', size: /^One size/, color: 'Bone' },
  { key: 'tote', radio: 'TOTE', size: /^One size/, color: 'Bone' },
];

async function answerText(page: Page, value: string) {
  await page.getByLabel('Your answer').fill(value);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function reachObjectSelection(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await expect(page.getByText('VISUAL QA / NOT PRODUCTION')).toBeVisible();
  await expect(page.getByText('01 / 07')).toBeVisible();

  await answerText(page, 'The Master and Margarita');
  await answerText(page, 'a quiet cabin above a valley');
  await page.getByLabel('4 a.m.').check();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await answerText(page, 'quiet does not mean uncertain');
  await answerText(page, 'a song that feels older than it is');
  await answerText(page, 'literal portraits');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await expect(page.getByText('FORM / CURRENT ISSUE')).toBeVisible();
}

async function finishPreviewPurchase(page: Page, item: MatrixObject) {
  await reachObjectSelection(page);
  await page.getByRole('radio', { name: item.radio, exact: true }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();

  await expect(page.getByRole('heading', { name: 'Pick your size.' })).toBeVisible();
  await page.getByRole('radio', { name: item.size }).check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();

  await expect(page.getByRole('heading', { name: 'Color your issue.' })).toBeVisible();
  await page.getByRole('radio', { name: item.color }).check();
  await page.getByRole('button', { name: 'LOCK BASE' }).click();

  await expect(page.getByRole('heading', { name: 'Where do we find you?' })).toBeVisible();
  await page.getByLabel('Email').fill(`${item.key}.matrix@example.com`);
  await page.getByRole('button', { name: 'SEND CODE' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'VERIFY' }).click();

  await expect(page.getByRole('heading', { name: 'Where does it go?' })).toBeVisible();
  await page.getByLabel('Name').fill('Matrix Customer');
  await page.getByLabel('Address', { exact: true }).fill('1 Preview Street');
  await page.getByLabel('City').fill('Peshawar');
  await page.getByLabel('Province / state / region').fill('Khyber Pakhtunkhwa');
  await page.getByLabel('Postal code').fill('25000');
  await page.getByLabel('Country').selectOption('PK');
  await page.getByLabel('Phone').fill('+923001234567');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();

  await expect(page.getByText('$54.00')).toBeVisible();
  await expect(page.getByText('Everything else stays unknown until it arrives.')).toBeVisible();
  await page.getByRole('button', { name: 'ISSUE MINE' }).click();
  await expect(page.getByRole('heading', { name: 'PREVIEW COMPLETE.' })).toBeVisible();
  await expect(page.getByText('No payment was attempted.')).toBeVisible();
}

for (const item of MATRIX) {
  test(`${item.key} preview purchase completes without payment`, async ({ page }, testInfo) => {
    await finishPreviewPurchase(page, item);
    await mkdir('artifacts/visual', { recursive: true });
    await page.screenshot({
      path: `artifacts/visual/catalog-${item.key}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
}