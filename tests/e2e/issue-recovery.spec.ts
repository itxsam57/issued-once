import { expect, test } from '@playwright/test';

test('a lost-session buyer can recover an Issue without existence leakage before OTP proof', async ({ page }) => {
  let restored = false;
  const supportMessage = 'My tracking link has not updated for several days.';

  await page.route('**/api/issue/status', async (route) => {
    if (!restored) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: false }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        issueCode: 'IO-ABCD-EFGH',
        status: 'IN TRANSIT',
        objectType: 'TEE',
        sizeCode: 'M',
        colorCode: 'BLACK',
        trackingUrl: null,
        trackingNumber: null,
        updatedAt: '2026-08-31T16:00:00.000Z',
      }),
    });
  });

  await page.route('**/api/issue/recovery/request', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'challenge-1',
        retryAfterSeconds: 60,
        requestTag: 'CHALLENG',
      }),
    });
  });

  await page.route('**/api/issue/recovery/verify', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
      challengeId: 'challenge-1',
      code: '123456',
    });
    restored = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ restored: true }),
    });
  });

  await page.route('**/api/support', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ message: supportMessage });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ received: true, issueCode: 'IO-ABCD-EFGH' }),
    });
  });

  await page.goto('/issue');
  await expect(page.getByRole('heading', { name: 'Hold this thought.' })).toBeVisible();
  await page.getByRole('button', { name: 'FIND MY ISSUE' }).click();
  await expect(page.getByRole('heading', { name: 'Find your Issue.' })).toBeVisible();

  await page.getByLabel('Issue Code').fill('IO-ABCD-EFGH');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByRole('button', { name: 'SEND CODE' }).click();
  await expect(page.getByText('If those details match an Issue, six digits are on the way.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/we found|does not exist|no issue/i);

  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'RESTORE ISSUE' }).click();

  await expect(page.getByText('ISSUE / IO-ABCD-EFGH')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'IN TRANSIT' })).toBeVisible();

  await page.getByLabel('Tell us what happened').fill(supportMessage);
  await page.getByRole('button', { name: 'SEND TO SUPPORT' }).click();
  await expect(page.getByText(/support received/i)).toBeVisible();
});
