import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createPaymentService: vi.fn(),
  start: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookiesMock }));
vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: mocks.createPaymentService,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/payments/create/route';
import {
  createSafepaySandboxQaSessionValue,
  SAFEPAY_SANDBOX_QA_COOKIE,
} from '@/server/payments/safepaySandboxQa';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';

const experienceToken = 'team5-sandbox-customer-session';
let qaCookie: string | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  qaCookie = null;
  vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
  vi.stubEnv('ENABLE_SAFEPAY_SANDBOX_QA', '1');
  vi.stubEnv('SAFEPAY_ENVIRONMENT', 'sandbox');
  vi.stubEnv('SAFEPAY_API_KEY', 'sandbox-api-key');
  vi.stubEnv('SAFEPAY_API_SECRET', 'sandbox-api-secret');
  vi.stubEnv('SAFEPAY_WEBHOOK_SECRET', 'sandbox-webhook-secret');
  vi.stubEnv('INTERNAL_OPERATIONS_TOKEN', 'owner-operations-token-that-is-long-enough');
  mocks.start.mockResolvedValue({ paymentAttemptId: 'payment-sandbox-qa', checkoutUrl: 'https://sandbox.api.getsafepay.com/embedded?tracker=track_team5' });
  mocks.createPaymentService.mockReturnValue({ start: mocks.start });
  mocks.cookiesMock.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === SESSION_COOKIE_NAME) return { value: experienceToken };
      if (name === SAFEPAY_SANDBOX_QA_COOKIE && qaCookie) return { value: qaCookie };
      return undefined;
    }),
  });
});

afterEach(() => vi.unstubAllEnvs());

test('Safepay sandbox payment fails closed for an ordinary public customer session', async () => {
  const response = await POST(new Request('https://issuedonce.shop/api/payments/create', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: 'quote-1' }),
  }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Payment is unavailable' });
  expect(mocks.createPaymentService).not.toHaveBeenCalled();
});

test('Owner-started QA customer uses the real Safepay sandbox payment runtime', async () => {
  qaCookie = createSafepaySandboxQaSessionValue();
  const response = await POST(new Request('https://issuedonce.shop/api/payments/create', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: 'quote-1' }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(expect.objectContaining({ paymentAttemptId: 'payment-sandbox-qa' }));
  expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({
    sessionToken: experienceToken,
    quoteId: 'quote-1',
    returnBaseUrl: 'https://issuedonce.shop',
  }));
});

test('sandbox runtime stays dark when the explicit QA switch is disabled', async () => {
  qaCookie = createSafepaySandboxQaSessionValue();
  vi.stubEnv('ENABLE_SAFEPAY_SANDBOX_QA', '0');
  const response = await POST(new Request('https://issuedonce.shop/api/payments/create', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: 'quote-1' }),
  }));
  expect(response.status).toBe(503);
  expect(mocks.createPaymentService).not.toHaveBeenCalled();
});

test('production Safepay payment behavior does not depend on the sandbox QA cookie', async () => {
  vi.stubEnv('SAFEPAY_ENVIRONMENT', 'production');
  const response = await POST(new Request('https://issuedonce.shop/api/payments/create', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: 'quote-1' }),
  }));
  expect(response.status).toBe(200);
  expect(mocks.start).toHaveBeenCalledOnce();
});
