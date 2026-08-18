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
  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await expect(page.getByText('01 / 07')).toBeVisible();

  await continueText(page, 'The Master and Margarita', '02 / 07');
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
  await expect(page.getByText('FORM / CURRENT ISSUE')).toBeVisible();
}

test('public physical flow reaches provider-backed commitment and redirects to hosted checkout without trusted browser product facts', async ({ page }, testInfo) => {
  await reachPhysicalForm(page);

  await page.getByRole('radio', { name: 'TEE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();

  await expect(page.getByText('FORM LOCKED / FIT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick your size.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Medium/ })).toBeVisible();
  await capture(page, `12-public-fit-${testInfo.project.name}`);

  await page.getByRole('radio', { name: /^Medium/ }).check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();

  await expect(page.getByText('FIT LOCKED / BASE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Color your issue.' })).toBeVisible();
  for (const color of ['Bone', 'Black', 'Ash', 'Navy', 'Forest']) {
    await expect(page.getByRole('radio', { name: color })).toBeVisible();
  }
  await capture(page, `13-public-base-${testInfo.project.name}`);

  await page.getByRole('radio', { name: 'Bone' }).check();
  const baseRequestPromise = page.waitForRequest((request) =>
    request.url().endsWith('/api/experience/base') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'LOCK BASE' }).click();
  const baseRequest = await baseRequestPromise;
  expect(baseRequest.postDataJSON()).toEqual({ colorCode: 'Bone' });

  await expect(page.getByText('FORM COMPLETE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeVisible();
  await expect(page.getByText('TEE / M / BONE')).toBeVisible();
  await expect(page.getByText('$32.00')).toBeVisible();
  await expect(page.getByText('Everything else stays unknown until it arrives.')).toBeVisible();
  const issueMine = page.getByRole('button', { name: 'ISSUE MINE' });
  await expect(issueMine).toBeVisible();
  await capture(page, `14-public-commitment-${testInfo.project.name}`);

  await page.route('https://checkout.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><h1>HOSTED CHECKOUT TEST</h1></body></html>',
    });
  });
  await page.route('**/api/checkout/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ checkoutUrl: 'https://checkout.example.test/issued-once' }),
    });
  });

  const checkoutRequestPromise = page.waitForRequest((request) =>
    request.url().endsWith('/api/checkout/start') && request.method() === 'POST',
  );
  await issueMine.click();
  const checkoutRequest = await checkoutRequestPromise;
  const checkoutPayload = checkoutRequest.postDataJSON() as Record<string, unknown>;
  expect(Object.keys(checkoutPayload)).toEqual(['quoteId']);
  expect(typeof checkoutPayload.quoteId).toBe('string');
  expect(String(checkoutPayload.quoteId).length).toBeGreaterThan(0);

  await page.waitForURL('https://checkout.example.test/issued-once');
  await expect(page.getByRole('heading', { name: 'HOSTED CHECKOUT TEST' })).toBeVisible();
});
