import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type BootstrapQuestion = {
  id: string;
  prompt: string;
  kind: 'text' | 'choice';
  optional?: boolean;
  choices?: readonly { value: string; label: string }[];
};

type BootstrapPayload = {
  entryMode: 'interview' | 'profile' | 'repeat-choice' | 'form';
  stage: string;
  initialPosition: number;
  interviewComplete: boolean;
  questions: BootstrapQuestion[];
};

async function capture(page: Page, name: string) {
  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({ path: `artifacts/visual/${name}.png`, fullPage: true });
}

async function installDeliveryStubs(page: Page) {
  await page.route('**/api/contact/request-otp', async (route) => {
    const body = route.request().postDataJSON() as { email: string };
    expect(body).toEqual({ email: 'repeat@example.com' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ challengeId: 'challenge-repeat', retryAfterSeconds: 60 }),
    });
  });

  await page.route('**/api/contact/verify-otp', async (route) => {
    const body = route.request().postDataJSON() as { challengeId: string; code: string };
    expect(body).toEqual({ challengeId: 'challenge-repeat', code: '123456' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verified: true }),
    });
  });

  await page.route('**/api/shipping', async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    expect(body).toMatchObject({
      recipientName: 'Repeat Customer',
      line1: '7 New Issue Road',
      city: 'Peshawar',
      region: 'Khyber Pakhtunkhwa',
      postalCode: '25000',
      countryCode: 'PK',
      phone: '+923001234567',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ saved: true }),
    });
  });
}

async function answerSevenAssignedQuestions(page: Page) {
  for (let position = 1; position <= 7; position += 1) {
    await expect(page.getByText(`${String(position).padStart(2, '0')} / 07`)).toBeVisible();

    const textAnswer = page.getByLabel('Your answer');
    if (await textAnswer.isVisible().catch(() => false)) {
      await textAnswer.fill(`repeat-order-answer-${position}`);
    } else {
      const radios = page.getByRole('radio');
      expect(await radios.count()).toBeGreaterThan(0);
      await radios.first().check();
    }

    const continueButton = page.getByRole('button', { name: 'CONTINUE' });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  }

  await expect(page.getByRole('heading', { name: 'WE HAVE ENOUGH.' })).toBeVisible();
}

async function reachCommitment(page: Page) {
  await page.getByRole('radio', { name: 'TEE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();
  await expect(page.getByRole('heading', { name: 'Pick your size.' })).toBeVisible();

  await page.getByRole('radio', { name: 'M', exact: true }).check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();
  await expect(page.getByRole('heading', { name: 'Color your issue.' })).toBeVisible();

  await page.getByRole('radio', { name: 'Bone' }).check();
  await page.getByRole('button', { name: 'LOCK BASE' }).click();
  await expect(page.getByRole('heading', { name: 'Where do we find you?' })).toBeVisible();

  await page.getByLabel('Email').fill('repeat@example.com');
  await page.getByRole('button', { name: 'SEND CODE' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'VERIFY' }).click();

  await expect(page.getByRole('heading', { name: 'Where does it go?' })).toBeVisible();
  await page.getByLabel('Name').fill('Repeat Customer');
  await page.getByLabel('Address', { exact: true }).fill('7 New Issue Road');
  await page.getByLabel('City').fill('Peshawar');
  await page.getByLabel('Province / state / region').fill('Khyber Pakhtunkhwa');
  await page.getByLabel('Postal code').fill('25000');
  await page.getByLabel('Country').selectOption('PK');
  await page.getByLabel('Phone').fill('+923001234567');
  await page.getByRole('button', { name: 'USE THIS ADDRESS' }).click();

  await expect(page.getByText('FORM COMPLETE')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'From here, it becomes ours to interpret.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'ISSUE MINE' })).toBeVisible();
}

async function previewCheckout(page: Page): Promise<string> {
  const paymentResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/payments/create') &&
    response.request().method() === 'POST',
  );
  const repeatScreenPromise = page.waitForURL(/\/begin\?payment=preview$/);

  await page.getByRole('button', { name: 'ISSUE MINE' }).click();

  const paymentResponse = await paymentResponsePromise;
  expect(paymentResponse.status()).toBe(200);
  const payment = await paymentResponse.json() as {
    checkoutUrl: string;
    paymentAttemptId: string;
  };
  expect(payment.checkoutUrl).toBe('/begin?payment=preview');
  expect(payment.paymentAttemptId).toMatch(/^preview:/);

  await repeatScreenPromise;
  await expect(page.getByRole('heading', { name: 'MAKE ANOTHER ONE?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'KEEP PREVIOUS ANSWERS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ANSWER AGAIN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'UNLOCK FORM' })).toHaveCount(0);

  return payment.paymentAttemptId;
}

test.describe('repeat-order lifecycle', () => {
  test.setTimeout(180_000);

  test('three successive orders remain isolated across reuse and fresh-answer paths', async ({ page }, testInfo) => {
    await installDeliveryStubs(page);

    const firstStartPromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/experience/start') &&
      response.request().method() === 'POST',
    );
    await page.goto('/begin');
    const firstStartResponse = await firstStartPromise;
    expect(firstStartResponse.status()).toBe(200);
    const firstStart = await firstStartResponse.json() as BootstrapPayload;
    expect(firstStart.entryMode).toBe('interview');
    expect(firstStart.questions).toHaveLength(7);
    const firstPrompts = new Set(firstStart.questions.map((question) => question.prompt));

    await answerSevenAssignedQuestions(page);
    await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
    await expect(page.getByRole('heading', { name: 'Pick the shape your issue lives on.' })).toBeVisible();
    await reachCommitment(page);
    const firstPaymentId = await previewCheckout(page);
    await capture(page, `16-repeat-choice-first-${testInfo.project.name}`);

    const reuseResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/experience/repeat') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'KEEP PREVIOUS ANSWERS' }).click();
    const reuseResponse = await reuseResponsePromise;
    expect(reuseResponse.status()).toBe(200);
    const reuse = await reuseResponse.json() as BootstrapPayload;
    expect(reuse.entryMode).toBe('form');
    expect(reuse.stage).toBe('PROFILE_COMPLETE');
    expect(reuse.questions).toEqual([]);

    await expect(page.getByRole('heading', { name: 'Pick the shape your issue lives on.' })).toBeVisible();
    await expect(page.getByText('01 / 07')).toHaveCount(0);
    await reachCommitment(page);
    const secondPaymentId = await previewCheckout(page);
    await capture(page, `17-repeat-choice-second-${testInfo.project.name}`);

    const freshResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/experience/repeat') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'ANSWER AGAIN' }).click();
    const freshResponse = await freshResponsePromise;
    expect(freshResponse.status()).toBe(200);
    const fresh = await freshResponse.json() as BootstrapPayload;
    expect(fresh.entryMode).toBe('interview');
    expect(fresh.stage).toBe('QUESTION_1');
    expect(fresh.questions).toHaveLength(7);
    for (const question of fresh.questions) {
      expect(firstPrompts.has(question.prompt)).toBe(false);
    }

    await expect(page.getByText(fresh.questions[0].prompt)).toBeVisible();
    await capture(page, `18-repeat-fresh-question-${testInfo.project.name}`);
    await answerSevenAssignedQuestions(page);
    await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
    await expect(page.getByRole('heading', { name: 'Pick the shape your issue lives on.' })).toBeVisible();
    await reachCommitment(page);
    const thirdPaymentId = await previewCheckout(page);

    expect(new Set([firstPaymentId, secondPaymentId, thirdPaymentId]).size).toBe(3);
    await capture(page, `19-repeat-choice-third-${testInfo.project.name}`);
  });
});
