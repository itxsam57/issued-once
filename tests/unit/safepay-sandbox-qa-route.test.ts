import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasOpsSession: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: mocks.hasOpsSession }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: mocks.setCookie }),
}));

async function route() {
  const routePath = join(process.cwd(), 'src/app/ops/api/safepay-sandbox/session/route.ts');
  expect(existsSync(routePath), 'Safepay sandbox QA session route must exist').toBe(true);
  return import(/* @vite-ignore */ routePath) as Promise<{ POST: () => Promise<Response> }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasOpsSession.mockResolvedValue(true);
  vi.stubEnv('ENABLE_SAFEPAY_SANDBOX_QA', '1');
  vi.stubEnv('SAFEPAY_ENVIRONMENT', 'sandbox');
  vi.stubEnv('SAFEPAY_API_KEY', 'sandbox-api-key');
  vi.stubEnv('SAFEPAY_API_SECRET', 'sandbox-api-secret');
  vi.stubEnv('SAFEPAY_WEBHOOK_SECRET', 'sandbox-webhook-secret');
  vi.stubEnv('INTERNAL_OPERATIONS_TOKEN', 'owner-operations-token-that-is-long-enough');
});

afterEach(() => vi.unstubAllEnvs());

test('authenticated Owner can mint a short-lived Safepay sandbox QA session', async () => {
  const { POST } = await route();
  const response = await POST();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ active: true, url: '/begin?qa=safepay' });
  expect(mocks.setCookie).toHaveBeenCalledWith(
    'io_safepay_qa',
    expect.stringMatching(/^[a-f0-9]{64}$/),
    expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: 3600 }),
  );
});

test('sandbox QA session cannot be minted without Owner auth', async () => {
  mocks.hasOpsSession.mockResolvedValue(false);
  const { POST } = await route();
  const response = await POST();
  expect(response.status).toBe(401);
  expect(mocks.setCookie).not.toHaveBeenCalled();
});

test('sandbox QA session fails closed when the explicit switch is off', async () => {
  vi.stubEnv('ENABLE_SAFEPAY_SANDBOX_QA', '0');
  const { POST } = await route();
  const response = await POST();
  expect(response.status).toBe(503);
  expect(mocks.setCookie).not.toHaveBeenCalled();
});

test('sandbox QA session can never be minted against Safepay production', async () => {
  vi.stubEnv('SAFEPAY_ENVIRONMENT', 'production');
  const { POST } = await route();
  const response = await POST();
  expect(response.status).toBe(503);
  expect(mocks.setCookie).not.toHaveBeenCalled();
});
