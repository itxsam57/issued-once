import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const tempMailUrl = 'https://temp-mail.org/en/';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function matchesPost(response, path) {
  try {
    return new URL(response.url()).pathname === path && response.request().method() === 'POST';
  } catch {
    return false;
  }
}

async function requirePost(page, path, action) {
  const responsePromise = page.waitForResponse((response) => matchesPost(response, path), {
    timeout: 20_000,
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
  await page.getByText(progress(position)).waitFor({ timeout: 15_000 });
  const radios = page.locator('input[type="radio"]');
  if ((await radios.count()) > 0) {
    await radios.first().check();
  } else {
    await page.getByLabel('Your answer').fill(`production otp smoke answer ${position}`);
  }
  await requirePost(page, '/api/experience/answer', () =>
    page.getByRole('button', { name: 'CONTINUE' }).click(),
  );
}

async function reachContact(page) {
  const home = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  if (!home?.ok()) throw new Error(`homepage returned HTTP ${home?.status() ?? 'NO_RESPONSE'}`);

  await page.getByRole('link', { name: /BEGIN/ }).first().click();
  await page.waitForURL('**/begin');

  for (let position = 1; position <= 7; position += 1) {
    await answerCurrentQuestion(page, position);
  }

  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await page.getByRole('button', { name: 'LOCK FORM' }).waitFor({ timeout: 10_000 });
  await page.getByRole('radio', { name: 'TEE', exact: true }).check();
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

  await page.getByRole('heading', { name: 'Where do we find you?' }).waitFor({ timeout: 15_000 });
}

async function dismissTempMailConsent(page) {
  const candidates = [
    page.getByRole('button', { name: /accept/i }).first(),
    page.getByRole('button', { name: /agree/i }).first(),
    page.getByRole('button', { name: /got it/i }).first(),
  ];
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click().catch(() => {});
      break;
    }
  }
}

async function addressFromDom(page) {
  const values = await page.locator('input, textarea, [contenteditable="true"]').evaluateAll((elements) =>
    elements.map((element) => {
      if ('value' in element) return String(element.value ?? '').trim();
      return String(element.textContent ?? '').trim();
    }),
  ).catch(() => []);
  for (const value of values) {
    if (EMAIL_PATTERN.test(value)) return value;
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const bodyAddress = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return bodyAddress && EMAIL_PATTERN.test(bodyAddress) ? bodyAddress : null;
}

async function addressFromClipboard(page) {
  const copyCandidates = [
    page.getByRole('button', { name: /^Copy$/i }).first(),
    page.getByText(/^Copy$/i).first(),
  ];
  for (const candidate of copyCandidates) {
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click().catch(() => {});
    const clipboard = await page.evaluate(async () => navigator.clipboard.readText()).catch(() => '');
    const value = String(clipboard ?? '').trim();
    if (EMAIL_PATTERN.test(value)) return value;
  }
  return null;
}

async function readGeneratedTempAddress(page) {
  await page.goto(tempMailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await dismissTempMailConsent(page);

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const clipboardAddress = await addressFromClipboard(page);
    if (clipboardAddress) return clipboardAddress;

    const domAddress = await addressFromDom(page);
    if (domAddress) return domAddress;

    await page.waitForTimeout(1000);
  }

  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({
    path: 'artifacts/visual/tempmail-address-unavailable.png',
    fullPage: true,
  }).catch(() => {});
  throw new Error('Temp-Mail did not expose a generated mailbox address');
}

async function readOtpFromTempMail(page) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const subject = page.getByText(/Your ISSUED ONCE code/i).first();
    if (await subject.isVisible().catch(() => false)) {
      await subject.click();
      await page.waitForTimeout(1000);
      const body = await page.locator('body').innerText();
      const code = body.match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }

    const refreshCandidates = [
      page.getByRole('button', { name: /^Refresh$/i }).first(),
      page.getByText(/^Refresh$/i).first(),
    ];
    let refreshed = false;
    for (const refresh of refreshCandidates) {
      if (await refresh.isVisible().catch(() => false)) {
        await refresh.click().catch(() => {});
        refreshed = true;
        break;
      }
    }
    if (!refreshed) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    }
    await page.waitForTimeout(4000);
  }
  throw new Error('Temp-Mail did not receive the ISSUED ONCE OTP within 120 seconds');
}

const browser = await chromium.launch();
try {
  const tempContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const appContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const tempPage = await tempContext.newPage();
  const appPage = await appContext.newPage();

  try {
    const tempAddress = await readGeneratedTempAddress(tempPage);
    console.log('LIVE_TEMPMAIL_ADDRESS_READY');

    await reachContact(appPage);
    await appPage.getByLabel('Email').fill(tempAddress);
    await requirePost(appPage, '/api/contact/request-otp', () =>
      appPage.getByRole('button', { name: 'SEND CODE' }).click(),
    );
    await appPage.getByLabel('Verification code').waitFor({ timeout: 15_000 });
    console.log('LIVE_TEMPMAIL_OTP_REQUEST_ACCEPTED');

    const code = await readOtpFromTempMail(tempPage);
    console.log('LIVE_TEMPMAIL_OTP_RECEIVED');

    await appPage.getByLabel('Verification code').fill(code);
    await requirePost(appPage, '/api/contact/verify-otp', () =>
      appPage.getByRole('button', { name: 'VERIFY' }).click(),
    );

    await appPage.getByRole('heading', { name: 'Where does it go?' }).waitFor({ timeout: 15_000 });
    await mkdir('artifacts/visual', { recursive: true });
    await appPage.screenshot({
      path: 'artifacts/visual/live-production-tempmail-otp-verified.png',
      fullPage: true,
    });
    console.log('LIVE_TEMPMAIL_OTP_VERIFICATION_PASS');
  } finally {
    await tempContext.close();
    await appContext.close();
  }
} finally {
  await browser.close();
}
