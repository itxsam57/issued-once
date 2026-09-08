import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';
import { config, proxy } from '@/proxy';

const expectedHeaders = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
} as const;

function expectSecurityHeaders(path: string) {
  const response = proxy(new NextRequest(`https://issuedonce.shop${path}`));
  for (const [name, value] of Object.entries(expectedHeaders)) {
    expect(response.headers.get(name), `${name} on ${path}`).toBe(value);
  }
  return response;
}

test.each(['/', '/api/health/release', '/api/payments/create', '/ops'])(
  'Proxy adds the production security-header baseline to %s',
  (path) => {
    expectSecurityHeaders(path);
  },
);

test('Proxy matcher covers normal public and API traffic while skipping immutable Next assets', () => {
  expect(config.matcher).toEqual([
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]);
});

test('decommissioned endpoints keep no-store while also receiving the security baseline', () => {
  const response = expectSecurityHeaders('/api/checkout/start');
  expect(response.status).toBe(410);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
