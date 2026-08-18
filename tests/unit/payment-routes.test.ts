import { beforeEach, expect, test, vi } from 'vitest';

const { cookiesMock, createPaymentServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));

import { POST as createPayment } from '@/app/api/payments/create/route';
import { POST as safepayWebhook } from '@/app/api/webhooks/safepay/route';

beforeEach(() => {
  vi.clearAllMocks();
  cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: 'session-token' }) });
});

test('payment creation derives experience and return origin server-side', async () => {
  const start = vi.fn().mockResolvedValue({
    checkoutUrl: 'https://getsafepay.com/checkout/pay?beacon=track_1',
    paymentAttemptId: 'attempt-1',
  });
  createPaymentServiceMock.mockReturnValue({ start });

  const response = await createPayment(new Request('https://issuedonce.shop/api/payments/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteId: 'quote-1', returnBaseUrl: 'https://evil.example' }),
  }));

  expect(response.status).toBe(200);
  expect(start).toHaveBeenCalledWith({
    sessionToken: 'session-token',
    quoteId: 'quote-1',
    returnBaseUrl: 'https://issuedonce.shop',
  });
});

test('safepay webhook passes untouched body and headers into authenticated service', async () => {
  const handleWebhook = vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-1' });
  createPaymentServiceMock.mockReturnValue({ handleWebhook });
  const raw = '{"data":{"token":"evt-1"}}';
  const request = new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST',
    headers: { 'x-sfpy-signature': 'abc', 'content-type': 'application/json' },
    body: raw,
  });

  const response = await safepayWebhook(request);
  expect(response.status).toBe(200);
  expect(handleWebhook).toHaveBeenCalledWith({ rawBody: raw, headers: request.headers });
});

test('invalid authenticated webhook evidence is rejected and never returns success', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn(() => { throw new Error('Safepay webhook signature is invalid'); }),
  });
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'bad' },
  }));
  expect(response.status).toBe(401);
});
