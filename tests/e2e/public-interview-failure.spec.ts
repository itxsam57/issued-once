import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function answerCurrentQuestion(page: Page, position: number) {
  const continueButton = page.getByRole('button', { name: 'CONTINUE' });
  if (!(await continueButton.isEnabled())) {
    const answer = page.getByLabel('Your answer');
    if (await answer.isVisible().catch(() => false)) {
      await answer.fill(`failure-path-${position}`);
    } else {
      const choices = page.getByRole('radio');
      await expect(choices.first()).toBeVisible();
      await choices.first().check();
    }
  }
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}

async function answerSeven(page: Page) {
  for (let position = 1; position <= 7; position += 1) {
    await expect(page.getByText(`${String(position).padStart(2, '0')} / 07`)).toBeVisible();
    await answerCurrentQuestion(page, position);
  }
  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
}

const saveFailure = (page: Page) => page.getByText('The next step could not be saved.', { exact: true });

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
  expect(metrics.color).toBe('rgb(224, 128, 116)');
  expect(metrics.background).toBe('rgba(0, 0, 0, 0)');
  expect(metrics.fontSize).toBeLessThanOrEqual(11);
  expect(metrics.letterSpacing).toBeGreaterThanOrEqual(1.5);

  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({
    path: `artifacts/visual/10-save-recovery-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('physical selection and delivery route failures stay visible and retryable', async ({ page }) => {
  let objectAttempts = 0;
  let sizeAttempts = 0;
  let baseAttempts = 0;

  await page.route('**/api/experience/object', async (route) => {
    objectAttempts += 1;
    if (objectAttempts === 1) {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'That form is unavailable.' }) });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.route('**/api/experience/size', async (route) => {
    sizeAttempts += 1;
    if (sizeAttempts === 1) {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'That size is unavailable.' }) });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.route('**/api/experience/base', async (route) => {
    baseAttempts += 1;
    if (baseAttempts === 1) {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'That color is unavailable.' }) });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.route('**/api/contact/check-email', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alreadyVerified: false }) });
  });
  await page.route('**/api/contact/request-otp', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ challengeId: 'failure-otp', retryAfterSeconds: 0, requestTag: 'FAILURE1' }) });
  });
  await page.route('**/api/contact/verify-otp', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verified: true }) });
  });
  await page.route('**/api/shipping', async (route) => {
    const body = route.request().postDataJSON() as { phone?: string; line1?: string };
    if (body.phone === 'bad-phone') {
      await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Phone is invalid.' }) });
      return;
    }
    if (body.line1 === 'x') {
      await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Address is invalid.' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true }) });
  });

  await page.goto('/begin');
  await answerSeven(page);

  await page.getByRole('radio', { name: 'TEE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();
  await expect(saveFailure(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOCK FORM' })).toBeEnabled();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();
  await expect(page.getByRole('heading', { name: 'Pick your size.' })).toBeVisible();

  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();
  await expect(saveFailure(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONFIRM SIZE' })).toBeEnabled();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();
  await expect(page.getByRole('heading', { name: 'Color your issue.' })).toBeVisible();

  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'LOCK BASE' }).click();
  await expect(saveFailure(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOCK BASE' })).toBeEnabled();
  await page.getByRole('button', { name: 'LOCK BASE' }).click();
  await expect(page.getByRole('heading', { name: 'Where do we find you?' })).toBeVisible();

  await page.getByLabel('Email').fill('recovery@example.com');
  await page.getByRole('button', { name: 'SEND CODE' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'VERIFY' }).click();
  await expect(page.getByRole('heading', { name: 'Where does it go?' })).toBeVisible();

  await page.getByLabel('Name').fill('Recovery Customer');
  await page.getByLabel('Address', { exact: true }).fill('1 Valid Street');
  await page.getByLabel('City').fill('Peshawar');
  await page.getByLabel('Province / state / region').fill('Khyber Pakhtunkhwa');
  await page.getByLabel('Postal code').fill('25000');
  await page.getByLabel('Country').selectOption('PK');
  await page.getByLabel('Phone').fill('bad-phone');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();
  await expect(page.getByText('That address could not be saved yet.', { exact: true })).toBeVisible();

  await page.getByLabel('Phone').fill('+923001234567');
  await page.getByLabel('Address', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();
  await expect(page.getByText('That address could not be saved yet.', { exact: true })).toBeVisible();

  await page.getByLabel('Address', { exact: true }).fill('1 Valid Street');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();
  await expect(page.getByRole('heading', { name: 'From here, it becomes ours to interpret.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ISSUE MINE' })).toBeVisible();
  expect({ objectAttempts, sizeAttempts, baseAttempts }).toEqual({ objectAttempts: 2, sizeAttempts: 2, baseAttempts: 2 });
});
