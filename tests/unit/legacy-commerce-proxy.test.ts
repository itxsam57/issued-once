import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';
import { proxy } from '@/proxy';

test.each([
  '/api/checkout/start',
  '/api/webhooks/fourthwall',
])('legacy commerce endpoint %s is permanently gone from active runtime', async (path) => {
  const response = proxy(new NextRequest(`https://issuedonce.shop${path}`));
  expect(response.status).toBe(410);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({ error: 'Legacy endpoint is disabled' });
});
