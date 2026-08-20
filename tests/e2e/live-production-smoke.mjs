import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const testEmail = 'webrefreshlab@gmail.com';

function matchesPost(response, path) {
  try {
    return new URL(response.url()).pathname === path && response.request().method() === 'POST';
  } catch {
    return false;
  }
}

async function requirePost(page, path, action) {
  const responsePromise = page.waitForResponse((response) => matchesPost(response, path), {
    timeout: 15_000,
  });
  await action();
  const response = await responsePromise;
  const status = response.status();
  console.log(`${path}: HTTP ${status}`);
  if (!response.ok()) {
    const body = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`${path} failed with HTTP ${status}: ${body}`);
  }
  return response;
}

async function continueText(page, answer, nextProgress) {
  await page.getByLabel('Your answer').fill(answer);
  await requirePost(page, '/api/experience/answer', () =>
    page.getByRole('button', { name: 'CONTINUE' }).click(),
  );
  await page.getByText(nextProgress).waitFor({ timeout: 10_000 });
}

async function runJourney() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    const home = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    if (!home?.ok()) throw new Error(`homepage returned HTTP ${home?.status() ?? 'NO_RESPONSE'}`);

    await page.getByRole('link', { name: /BEGIN/ }).first().click();
    await page.waitForURL('**/begin');
    await page.getByText('01 / 07').waitFor({ timeout: 15_000 });

    await continueText(page, 'The Master and Margarita', '02 / 07');
    await continueText(page, 'a quiet cabin above a valley', '03 / 07');

    await page.getByLabel('4 a.m.').check();
    await requirePost(page, '/api/experience/answer', () =>
      page.getByRole('button', { name: 'CONTINUE' }).click(),
    );
    await page.getByText('04 / 07').waitFor({ timeout: 10_000 });

    await continueText(page, 'quiet does not mean uncertain', '05 / 07');
    await continueText(page, 'a song that feels older than it is', '06 / 07');
    await continueText(page, 'literal portraits', '07 / 07');

    await requirePost(page, '/api/experience/answer', () =>
      page.getByRole('button', { name: 'CONTINUE' }).click(),
    );
    await page.getByRole('heading', { name: 'WE HAVE ENOUGH.' }).waitFor({ timeout: 10_000 });

    await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
    await page.getByRole('radio', { name: 'TEE' }).check();
    await requirePost(page, '/api/experience/object', () =>
      page.getByRole('button', { name: 'LOCK FORM' }).click(),
    );

    await page.getByRole('radio', { name: 'M', exact: true }).check();
    await requirePost(page, '/api/experience/size', () =>
      page.getByRole('button', { name: 'CONFIRM SIZE' }).click(),
    );

    await page.getByRole('radio', { name: 'Bone' }).check();
    await requirePost(page, '/api/experience/base', () =>
      page.getByRole('button', { name: 'LOCK BASE' }).click(),
    );

    await page.getByRole('heading', { name: 'Where do we find you?' }).waitFor({ timeout: 10_000 });
    await page.getByLabel('Email').fill(testEmail);
    await requirePost(page, '/api/contact/request-otp', () =>
      page.getByRole('button', { name: 'SEND CODE' }).click(),
    );
    await page.getByLabel('Verification code').waitFor({ timeout: 10_000 });

    await mkdir('artifacts/visual', { recursive: true });
    await page.screenshot({
      path: 'artifacts/visual/live-production-otp-requested.png',
      fullPage: true,
    });
    console.log('LIVE_PRODUCTION_SMOKE_REACHED_REAL_OTP_REQUEST');
  } finally {
    await context.close();
    await browser.close();
  }
}

await runJourney();
