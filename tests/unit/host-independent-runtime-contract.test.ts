import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

function productionSources(root: string): Array<{ path: string; source: string }> {
  const files: Array<{ path: string; source: string }> = [];
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    if (statSync(absolute).isDirectory()) files.push(...productionSources(absolute));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry)) {
      files.push({ path: relative(process.cwd(), absolute), source: readFileSync(absolute, 'utf8') });
    }
  }
  return files;
}

test('production runtime has no Vercel package or source coupling', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencyNames = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
  expect(dependencyNames.filter((name) => name.startsWith('@vercel/'))).toEqual([]);
  expect(existsSync(join(process.cwd(), 'vercel.json'))).toBe(false);

  const coupled = productionSources(join(process.cwd(), 'src'))
    .filter(({ source }) => source.includes('@vercel/'))
    .map(({ path }) => path);
  expect(coupled).toEqual([]);
});

test('readiness reports private filesystem storage and durable Postgres jobs without Blob configuration', async () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://hidden',
    QUIZ_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString('base64'),
    IDENTITY_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
    MERCHANT_PUBLIC_NAME: 'ISSUED ONCE',
    MERCHANT_SUPPORT_EMAIL: 'support@issuedonce.shop',
    MERCHANT_PUBLIC_LOCATION: 'Lahore, Punjab, Pakistan',
    SAFEPAY_ENVIRONMENT: 'sandbox',
    SAFEPAY_API_KEY: 'hidden',
    SAFEPAY_WEBHOOK_SECRET: 'hidden',
    RESEND_API_KEY: 'hidden',
    RESEND_FROM_EMAIL: 'ISSUED ONCE <issue@issuedonce.shop>',
    SUPPORT_INBOX_EMAIL: 'support@issuedonce.shop',
    OPENAI_API_KEY: 'hidden',
    ARTWORK_STORAGE_DIR: '/private/artwork',
    ARTWORK_SIGNING_KEY: 'artwork-signing-key-that-is-long-enough',
    APP_ORIGIN: 'https://issuedonce.shop',
    CRON_SECRET: 'cron-secret-that-is-long-enough',
    PRINTFUL_API_TOKEN: 'hidden',
    PRINTFUL_WEBHOOK_PUBLIC_KEY: 'hidden',
    PRINTFUL_WEBHOOK_SECRET_HEX: 'aa'.repeat(32),
    PRINTFUL_VARIANT_MAP_JSON: '{}',
  };
  const service = new ReadinessService({
    env,
    databasePing: vi.fn(async () => true),
    storagePing: vi.fn(async () => true),
    queuePing: vi.fn(async () => true),
    fetchImpl: vi.fn(async (url: string) => {
      if (url.startsWith('https://api.openai.com/')) return new Response('{}', { status: 200 });
      if (url === 'https://api.printful.com/stores') return new Response(JSON.stringify({ result: [] }), { status: 200 });
      return new Response(null, { status: 404 });
    }) as typeof fetch,
  } as never);

  const result = await service.check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'storage', state: 'ready' }));
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'queues', state: 'ready' }));
  expect(result.checks.some((check) => check.key === 'blob')).toBe(false);
});

test('release health endpoint is present and exposes only safe deployment identity/readiness fields', () => {
  const routePath = join(process.cwd(), 'src/app/api/health/release/route.ts');
  expect(existsSync(routePath)).toBe(true);
  if (!existsSync(routePath)) return;
  const source = readFileSync(routePath, 'utf8');
  for (const field of ['runtimeProvider', 'releaseId', 'version', 'databaseReady', 'queueReady', 'storageReady']) {
    expect(source).toContain(field);
  }
  expect(source).not.toMatch(/RESEND_API_KEY|OPENAI_API_KEY|SAFEPAY_API_KEY|PRINTFUL_API_TOKEN|QUIZ_ENCRYPTION_KEY_V1/);
});
