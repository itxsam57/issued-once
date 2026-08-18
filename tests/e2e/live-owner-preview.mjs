import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.PREVIEW_URL;
if (!baseUrl) {
  throw new Error('PREVIEW_URL is required');
}

const profiles = [
  {
    name: 'desktop',
    context: { viewport: { width: 1440, height: 1000 } },
  },
  {
    name: 'mobile',
    context: { ...devices['Pixel 7'] },
  },
];

async function waitForCurrentDeployment(page) {
  let lastDetail = 'no response received';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await page.goto(`${baseUrl}/begin`, {
        waitUntil: 'domcontentloaded',
        timeout: 8_000,
      });
      const status = response?.status() ?? 'NO_RESPONSE';
      const title = await page.title().catch(() => 'NO_TITLE');

      if (!response?.ok()) {
        lastDetail = `attempt ${attempt}: HTTP ${status}, title=${JSON.stringify(title)}`;
        console.log(lastDetail);
        await page.waitForTimeout(2_000);
        continue;
      }

      try {
        await page.getByText('OWNER PREVIEW / NO PAYMENT').waitFor({ timeout: 2_500 });
        return;
      } catch {
        const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 240);
        lastDetail = `attempt ${attempt}: HTTP ${status}, title=${JSON.stringify(title)}, body=${JSON.stringify(bodyText)}`;
        console.log(lastDetail);
        await page.waitForTimeout(2_000);
      }
    } catch (error) {
      lastDetail = `attempt ${attempt}: ${String(error)}`;
      console.log(lastDetail);
      await page.waitForTimeout(2_000);
    }
  }

  throw new Error(`Vercel owner preview is not externally testable: ${lastDetail}`);
}

async function continueText(page, answer) {
  await page.getByLabel('Your answer').fill(answer);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function runJourney(browser, profile) {
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();

  await waitForCurrentDeployment(page);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'BEGIN' }).click();
  await page.waitForURL('**/begin');
  await page.getByText('OWNER PREVIEW / NO PAYMENT').waitFor();
  await page.getByText('01 / 07').waitFor();

  await continueText(page, 'old maps, storms, strange machines');
  await continueText(page, 'a quiet cabin above a valley');
  await page.getByLabel('4 a.m.').check();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await continueText(page, 'quiet does not mean uncertain');
  await continueText(page, 'a song that feels older than it is');
  await continueText(page, 'literal portraits');
  await page.getByRole('button', { name: 'CONTINUE' }).click();

  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await page.getByRole('radio', { name: 'HOODIE' }).check();
  await page.getByRole('button', { name: 'LOCK FORM' }).click();
  await page.getByRole('radio', { name: /Medium/ }).check();
  await page.getByRole('button', { name: 'CONFIRM SIZE' }).click();
  await page.getByRole('radio', { name: 'Bone' }).check();
  await page.getByRole('button', { name: 'LOCK BASE' }).click();
  await page.getByText('$54.00').waitFor();
  await page.getByRole('button', { name: 'ISSUE MINE' }).click();
  await page.getByRole('heading', { name: 'PREVIEW COMPLETE.' }).waitFor();
  await page.getByText('No payment was attempted.').waitFor();

  await mkdir('artifacts/visual', { recursive: true });
  await page.screenshot({
    path: `artifacts/visual/live-vercel-${profile.name}.png`,
    fullPage: true,
  });

  await context.close();
}

const browser = await chromium.launch();
try {
  for (const profile of profiles) {
    await runJourney(browser, profile);
  }
} finally {
  await browser.close();
}
