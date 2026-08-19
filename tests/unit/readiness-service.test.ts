import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

const placement = {
  fileType: 'front',
  printArea: { width: 1800, height: 2400, dpi: 150 },
  position: { width: 900, height: 1350, top: 300, left: 450 },
};

const completeEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://hidden',
  QUIZ_ENCRYPTION_KEY_V1: 'hidden-key',
  IDENTITY_HMAC_KEY: 'hidden-hmac',
  ISSUED_ONCE_CATALOG_JSON: JSON.stringify({
    currency: 'USD',
    products: {
      tee: { slug: 'io-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] },
      hat: { slug: 'io-hat', variants: [{ id: 'hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 4200, available: true }] },
      tote: { slug: 'io-tote', variants: [{ id: 'tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3800, available: true }] },
    },
  }),
  SAFEPAY_ENVIRONMENT: 'sandbox',
  SAFEPAY_API_KEY: 'hidden-safepay',
  SAFEPAY_WEBHOOK_SECRET: 'hidden-webhook',
  RESEND_API_KEY: 'hidden-resend',
  RESEND_FROM_EMAIL: 'ISSUED ONCE <issue@issuedonce.shop>',
  SUPPORT_INBOX_EMAIL: 'support@issuedonce.shop',
  OPENAI_API_KEY: 'hidden-openai',
  OPENAI_DESIGN_MODEL: 'gpt-5.6-terra',
  OPENAI_IMAGE_MODEL: 'gpt-image-2',
  BLOB_READ_WRITE_TOKEN: 'hidden-blob',
  PRINTFUL_API_TOKEN: 'hidden-printful',
  PRINTFUL_STORE_ID: '123',
  PRINTFUL_WEBHOOK_PUBLIC_KEY: 'hidden-public-key',
  PRINTFUL_WEBHOOK_SECRET_HEX: 'aa'.repeat(32),
  PRINTFUL_VARIANT_MAP_JSON: JSON.stringify({
    'tee:M:Black': { variantId: 4012, ...placement },
    'hat:OS:Black': { variantId: 5012, ...placement, position: { width: 900, height: 900, top: 300, left: 450 } },
    'tote:OS:Bone': { variantId: 6012, ...placement },
  }),
};

test('reports live/read-only boundaries separately from configured-only and safety gates', async () => {
  const service = new ReadinessService({
    env: completeEnv,
    databasePing: vi.fn(async () => true),
    blobPing: vi.fn(async () => true),
    fetchImpl: vi.fn(async (url: string) => {
      if (url.startsWith('https://api.openai.com/v1/models/')) {
        return new Response(JSON.stringify({ id: url.split('/').at(-1), object: 'model' }), { status: 200 });
      }
      if (url === 'https://api.printful.com/stores') {
        return new Response(JSON.stringify({ code: 200, result: [{ id: 123, name: 'ISSUED ONCE' }] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch,
  });

  const result = await service.check();
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'database', state: 'ready' }),
    expect.objectContaining({ key: 'openai', state: 'ready' }),
    expect.objectContaining({ key: 'blob', state: 'ready' }),
    expect.objectContaining({ key: 'printful', state: 'ready' }),
    expect.objectContaining({ key: 'safepay', state: 'configured' }),
    expect.objectContaining({ key: 'resend', state: 'configured' }),
    expect.objectContaining({ key: 'factory-confirm', state: 'safe' }),
  ]));
  expect(JSON.stringify(result)).not.toContain('hidden-');
  expect(result.readyForSandbox).toBe(true);
  expect(result.readyForProduction).toBe(false);
});

test('missing/invalid boundaries fail closed and never report production ready', async () => {
  const service = new ReadinessService({
    env: { SAFEPAY_ENVIRONMENT: 'production', PRINTFUL_ALLOW_CONFIRM: 'true' },
    databasePing: vi.fn(async () => false),
    blobPing: vi.fn(async () => false),
    fetchImpl: vi.fn() as typeof fetch,
  });
  const result = await service.check();
  expect(result.readyForSandbox).toBe(false);
  expect(result.readyForProduction).toBe(false);
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'database', state: 'missing' }),
    expect.objectContaining({ key: 'openai', state: 'missing' }),
    expect.objectContaining({ key: 'factory-confirm', state: 'armed' }),
  ]));
});
