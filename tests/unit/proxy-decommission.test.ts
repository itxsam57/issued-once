import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';
import { proxy } from '@/proxy';

test.each([
  '/api/checkout/start',
  '/api/webhooks/fourthwall',
  '/api/internal/design/approve',
  '/api/internal/manufacturing/create-draft',
  '/api/internal/manufacturing/confirm',
])('legacy or duplicate control surface %s is permanently gone', async (path) => {
  const response = proxy(new NextRequest(`https://issuedonce.shop${path}`));
  expect(response.status).toBe(410);
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test('active Safepay and /ops routes are not decommissioned by the proxy', () => {
  expect(proxy(new NextRequest('https://issuedonce.shop/api/payments/create')).status).toBe(200);
  expect(proxy(new NextRequest('https://issuedonce.shop/ops')).status).toBe(200);
});
