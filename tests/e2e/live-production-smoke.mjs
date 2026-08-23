import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const testEmail = 'webrefreshlab@gmail.com';
const PHYSICAL_MATRIX = [
  { key: 'tee', radio: 'TEE', size: /^Medium/, color: 'Bone', requestOtp: true },
  { key: 'hat', radio: 'CAP', size: /^One size/, color: 'Bone', requestOtp: false },
  { key: 'tote', radio: 'TOTE', size: /^One size/, color: 'Bone', requestOtp: false },
];

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

function progress(position) {
  return `${String(position).padStart(2, '0')} / 07`;
}

async function answerCurrentQuestion(page, position) {
  await page.getByText(progress(position)).waitFor({ timeout: 10_000 });

  const radios = page.locator('input[type="radio"]');
  if ((await radios.count()) > 0) {
    await radios.first().check();
  } else {
    await page.getByLabel('Your answer').fill(`production smoke answer ${position}`);
  }

  await requirePost(page, '/api/experience/answer', () =>
    page.getByRole('button', { name: 'CONTINUE' }).click(),
  );

  if (position < 7) {
    await page.getByText(progress(position + 1)).waitFor({ timeout: 10_000 });
  } else {
    await page.getByRole('heading', { name: 'WE HAVE ENOUGH.' }).waitFor({ timeout: 10_000 });
  }
}

async function reachObjectSelection(page) {
  const home = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  if (!home?.ok()) throw new Error(`homepage returned HTTP ${home?.status() ?? 'NO_RESPONSE'}`);

  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await page.waitForURL('**/begin');
  await page.getByText('01 / 07').waitFor({ timeout: 15_000 });

  for (let position = 1; position <= 7; position += 1) {
    await answerCurrentQuestion(page, position);
  }

  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await page.getByRole('button', { name: 'LOCK FORM' }).waitFor({ timeout: 10_000 });
}

async function exercisePhysicalGate(browser, item) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    await reachObjectSelection(page);
    await page.getByRole('radio', { name: item.radio, exact: true }).check();
    await requirePost(page, '/api/experience/object', () =>
      page.getByRole('button', { name: 'LOCK FORM' }).click(),
    );

    await page.getByRole('heading', { name: 'Pick your size.' }).waitFor({ timeout: 10_000 });
    await page.getByRole('radio', { name: item.size }).check();
    await requirePost(page, '/api/experience/size', () =>
      page.getByRole('button', { name: 'CONFIRM SIZE' }).click(),
    );

    await page.getByRole('heading', { name: 'Color your issue.' }).waitFor({ timeout: 10_000 });
    await page.getByRole('radio', { name: item.color }).check();
    await requirePost(page, '/api/experience/base', () =>
      page.getByRole('button', { name: 'LOCK BASE' }).click(),
    );

    await page.getByRole('heading', { name: 'Where do we find you?' }).waitFor({ timeout: 10_000 });
    await mkdir('artifacts/visual', { recursive: true });
    await page.screenshot({
      path: `artifacts/visual/live-production-${item.key}-physical-ready.png`,
      fullPage: true,
    });
    console.log(`LIVE_PRODUCTION_${item.key.toUpperCase()}_PHYSICAL_GATE_PASS`);

    if (item.requestOtp) {
      await page.getByLabel('Email').fill(testEmail);
      await requirePost(page, '/api/contact/request-otp', () =>
        page.getByRole('button', { name: 'SEND CODE' }).click(),
      );
      await page.getByLabel('Verification code').waitFor({ timeout: 10_000 });
      await page.screenshot({
        path: 'artifacts/visual/live-production-otp-requested.png',
        fullPage: true,
      });
      console.log('LIVE_PRODUCTION_SMOKE_REACHED_REAL_OTP_REQUEST');
    }
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const item of PHYSICAL_MATRIX) {
    await exercisePhysicalGate(browser, item);
  }
} finally {
  await browser.close();
}
