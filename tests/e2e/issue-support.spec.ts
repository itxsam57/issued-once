import { expect, test } from '@playwright/test';

test('a customer can open encrypted support from their current Issue and receive a safe reference', async ({ page }) => {
  await page.route('**/api/issue/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        issueCode: 'IO-ABCD-EFGH',
        status: 'IN PRODUCTION',
        objectType: 'TEE',
        sizeCode: 'M',
        colorCode: 'BLACK',
        trackingUrl: null,
        trackingNumber: null,
        updatedAt: '2026-08-31T18:00:00.000Z',
      }),
    });
  });

  await page.route('**/api/support', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      message: 'Reason: delivery-tracking\n\nThe tracking page has not changed for three days.',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        received: true,
        reference: '6f792ea4-74f6-4914-a6f7-a7ef63ec28e4',
      }),
    });
  });

  await page.goto('/issue');
  await expect(page.getByText('ISSUE / IO-ABCD-EFGH')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Need help?' })).toBeVisible();

  await page.getByLabel('Reason').selectOption('delivery-tracking');
  await page.getByLabel('What happened?').fill('The tracking page has not changed for three days.');
  await page.getByRole('button', { name: 'SEND TO SUPPORT' }).click();

  await expect(page.getByRole('status')).toContainText('Support request received.');
  await expect(page.getByRole('status')).toContainText('6f792ea4-74f6-4914-a6f7-a7ef63ec28e4');
});
