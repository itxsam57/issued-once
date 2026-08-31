import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

function env(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://configured',
    QUIZ_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString('base64'),
    IDENTITY_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
    MERCHANT_PUBLIC_NAME: 'ISSUED ONCE', MERCHANT_SUPPORT_EMAIL: 'support@issuedonce.shop', MERCHANT_PUBLIC_LOCATION: 'Lahore, Punjab, Pakistan',
    ISSUED_ONCE_CATALOG_JSON: JSON.stringify({
      currency: 'USD',
      products: {
        tee: { slug: 'io-tee', variants: [{ id: 't1', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, available: true }] },
        hat: { slug: 'io-hat', variants: [{ id: 'h1', size: 'OS', colorName: 'Black', colorSwatch: '#000000', amountMinor: 4200, available: true }] },
        tote: { slug: 'io-tote', variants: [{ id: 'b1', size: 'OS', colorName: 'Bone', colorSwatch: '#eee9dd', amountMinor: 3800, available: true }] },
      },
    }),
    SAFEPAY_ENVIRONMENT: 'sandbox', SAFEPAY_API_KEY: 'safepay', SAFEPAY_WEBHOOK_SECRET: 'webhook',
    RESEND_API_KEY: 'resend', RESEND_FROM_EMAIL: 'issue@issuedonce.shop', SUPPORT_INBOX_EMAIL: 'support@issuedonce.shop',
    OPENAI_API_KEY: 'openai',
    ARTWORK_STORAGE_DIR: '/private/artwork', ARTWORK_SIGNING_KEY: 'artwork-signing-key-that-is-long-enough', APP_ORIGIN: 'https://issuedonce.shop',
    CRON_SECRET: 'cron-secret-that-is-long-enough',
    PRINTFUL_API_TOKEN: 'printful', PRINTFUL_STORE_ID: '123', PRINTFUL_WEBHOOK_PUBLIC_KEY: 'public-key',
    PRINTFUL_WEBHOOK_SECRET_HEX: 'aa'.repeat(32),
    PRINTFUL_VARIANT_MAP_JSON: JSON.stringify({
      'tee:M:Black': { variantId: 1, fileType: 'front', printArea: { width: 1800, height: 2400, dpi: 150 }, position: { width: 900, height: 1350, top: 300, left: 450 } },
      'hat:OS:Black': { variantId: 2, fileType: 'front', printArea: { width: 1800, height: 2400, dpi: 150 }, position: { width: 900, height: 900, top: 300, left: 450 } },
      'tote:OS:Bone': { variantId: 3, fileType: 'front', printArea: { width: 1800, height: 2400, dpi: 150 }, position: { width: 900, height: 1350, top: 300, left: 450 } },
    }),
    ...overrides,
  };
}

function service(environment: NodeJS.ProcessEnv) {
  return new ReadinessService({
    env: environment,
    databasePing: vi.fn(async () => true),
    catalogAuthorityPing: vi.fn(async () => true),
    storagePing: vi.fn(async () => true),
    queuePing: vi.fn(async () => true),
    fetchImpl: vi.fn(async (url: string) => {
      if (url.startsWith('https://api.openai.com/')) return new Response('{}', { status: 200 });
      if (url === 'https://api.printful.com/stores') return new Response(JSON.stringify({ result: [{ id: 123 }] }), { status: 200 });
      return new Response(null, { status: 404 });
    }) as typeof fetch,
  });
}

test('catalog currency outside Safepay USD/PKR blocks sandbox readiness', async () => {
  const catalog = JSON.parse(env().ISSUED_ONCE_CATALOG_JSON!);
  catalog.currency = 'EUR';
  const result = await service(env({ ISSUED_ONCE_CATALOG_JSON: JSON.stringify(catalog) })).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'catalog', state: 'blocked' }));
  expect(result.readyForSandbox).toBe(false);
});

test('Printful webhook secret must be non-empty even-length hexadecimal', async () => {
  const result = await service(env({ PRINTFUL_WEBHOOK_SECRET_HEX: 'not-hex' })).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'printful', state: 'blocked' }));
  expect(result.readyForSandbox).toBe(false);
});
