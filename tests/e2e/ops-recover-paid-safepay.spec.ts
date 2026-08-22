import { expect, test } from '@playwright/test';

const tracker = 'track_2d48c8c8-bdd5-454c-993d-be6223bccf8b';

test('one-time recovery of the already-paid production Safepay tracker', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Run the production reconciliation probe exactly once.');

  const response = await fetch(
    `https://issuedonce.shop/payment/return?tracker=${encodeURIComponent(tracker)}`,
    { redirect: 'manual' },
  );

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toContain('/payment/pending');
});
