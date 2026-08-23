import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

const placement = {
  fileType: 'front',
  printArea: { width: 1800, height: 2400, dpi: 150 },
  position: { width: 900, height: 1350, top: 300, left: 450 },
};

const completeEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://hidden',
  QUIZ_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString('base64'),
  IDENTITY_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
  MERCHANT_PUBLIC_NAME: 'ISSUED ONCE',
  MERCHANT_SUPPORT_EMAIL: 'support@issuedonce.shop',
  MERCHANT_PUBLIC_LOCATION: 'Lahore, Punjab, Pakistan',
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
  OPENAI_IMAGE_MODEL: 'gpt-image-1.5',
  ARTWORK_STORAGE_DIR: '/private/artwork',
  ARTWORK_SIGNING_KEY: 'artwork-signing-key-that-is-long-enough',
  APP_ORIGIN: 'https://issuedonce.shop',
  CRON_SECRET: 'cron-secret-that-is-long-enough',
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

function healthyDependencies(env: NodeJS.ProcessEnv) {
  return {
    env,
    databasePing: vi.fn(async () => true),
    storagePing: vi.fn(async () => true),
    queuePing: vi.fn(async () => true),
    fetchImpl: vi.fn(async (url: string) => {
      if (url.startsWith('https://api.openai.com/v1/models/')) {
        return new Response(JSON.stringify({ id: url.split('/').at(-1), object: 'model' }), { status: 200 });
      }
      if (url === 'https://api.printful.com/stores') {
        return new Response(JSON.stringify({ code: 200, result: [{ id: 123, name: 'ISSUED ONCE' }] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch,
  };
}

test('reports live/read-only boundaries separately from configured-only and safety gates', async () => {
  const service = new ReadinessService(healthyDependencies(completeEnv));

  const result = await service.check();
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'database', state: 'ready' }),
    expect.objectContaining({ key: 'privacy', state: 'ready' }),
    expect.objectContaining({ key: 'merchant', state: 'ready' }),
    expect.objectContaining({ key: 'openai', state: 'ready' }),
    expect.objectContaining({ key: 'storage', state: 'ready' }),
    expect.objectContaining({ key: 'queues', state: 'ready' }),
    expect.objectContaining({ key: 'printful', state: 'ready' }),
    expect.objectContaining({ key: 'safepay', state: 'configured' }),
    expect.objectContaining({ key: 'resend', state: 'configured' }),
    expect.objectContaining({ key: 'factory-confirm', state: 'safe' }),
  ]));
  expect(JSON.stringify(result)).not.toContain('hidden-');
  expect(JSON.stringify(result)).not.toContain('support@issuedonce.shop');
  expect(JSON.stringify(result)).not.toContain('Lahore, Punjab, Pakistan');
  expect(result.readyForSandbox).toBe(true);
  expect(result.readyForProduction).toBe(false);
});

test('merchant disclosure fails sandbox readiness closed when required public identity is missing', async () => {
  const env = { ...completeEnv };
  delete env.MERCHANT_PUBLIC_NAME;
  delete env.MERCHANT_SUPPORT_EMAIL;
  delete env.MERCHANT_PUBLIC_LOCATION;

  const result = await new ReadinessService(healthyDependencies(env)).check();

  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'merchant',
    state: 'missing',
    detail: expect.stringMatching(/public merchant/i),
  }));
  expect(result.readyForSandbox).toBe(false);
  expect(result.readyForProduction).toBe(false);
});

test('uses the audited boot catalog when the deployment override is absent', async () => {
  const env = { ...completeEnv };
  delete env.ISSUED_ONCE_CATALOG_JSON;
  const result = await new ReadinessService(healthyDependencies(env)).check();

  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'catalog',
    state: 'ready',
    detail: expect.stringMatching(/boot/i),
  }));
});

test('uses the same transparency-compatible default image model as the design runtime', async () => {
  const env = { ...completeEnv };
  delete env.OPENAI_IMAGE_MODEL;
  const dependencies = healthyDependencies(env);
  const result = await new ReadinessService(dependencies).check();

  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'openai', state: 'ready' }));
  expect(dependencies.fetchImpl).toHaveBeenCalledWith(
    'https://api.openai.com/v1/models/gpt-image-1.5',
    expect.any(Object),
  );
});

test('blocks GPT Image 2 readiness while transparent production artwork is required', async () => {
  const result = await new ReadinessService(healthyDependencies({
    ...completeEnv,
    OPENAI_IMAGE_MODEL: 'gpt-image-2',
  })).check();

  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'openai',
    state: 'blocked',
    detail: expect.stringMatching(/transparent/i),
  }));
  expect(result.readyForSandbox).toBe(false);
});

test('malformed privacy key material is blocked instead of treated as configured', async () => {
  const result = await new ReadinessService({
    ...healthyDependencies({ ...completeEnv, QUIZ_ENCRYPTION_KEY_V1: 'not-a-32-byte-key' }),
  }).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'privacy', state: 'blocked' }));
  expect(result.readyForSandbox).toBe(false);
});

test('missing boundaries fail closed and never report production ready', async () => {
  const result = await new ReadinessService({
    env: { NODE_ENV: 'test', SAFEPAY_ENVIRONMENT: 'production', PRINTFUL_ALLOW_CONFIRM: 'true' },
    databasePing: vi.fn(async () => false),
    storagePing: vi.fn(async () => false),
    queuePing: vi.fn(async () => false),
    fetchImpl: vi.fn() as typeof fetch,
  }).check();
  expect(result.readyForSandbox).toBe(false);
  expect(result.readyForProduction).toBe(false);
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'database', state: 'missing' }),
    expect.objectContaining({ key: 'merchant', state: 'missing' }),
    expect.objectContaining({ key: 'openai', state: 'missing' }),
    expect.objectContaining({ key: 'storage', state: 'missing' }),
    expect.objectContaining({ key: 'queues', state: 'missing' }),
    expect.objectContaining({ key: 'factory-confirm', state: 'armed' }),
  ]));
});
