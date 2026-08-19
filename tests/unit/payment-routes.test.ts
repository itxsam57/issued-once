import { beforeEach, expect, test, vi } from 'vitest';

const {
  cookiesMock,
  createPaymentServiceMock,
  createIssueServiceMock,
  enqueueDesignIssueMock,
  enqueueIssueNotificationMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  enqueueDesignIssueMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/issues/runtimeIssues', () => ({
  createIssueService: createIssueServiceMock,
  IssueRuntimeUnavailableError: class IssueRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/design/designQueue', () => ({
  enqueueDesignIssue: enqueueDesignIssueMock,
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));

import { POST as createPayment } from '@/app/api/payments/create/route';
import { POST as safepayWebhook } from '@/app/api/webhooks/safepay/route';

beforeEach(() => {
  vi.clearAllMocks();
  cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: 'session-token' }) });
  createIssueServiceMock.mockReturnValue({
    reserveForPaidAttempt: vi.fn().mockResolvedValue({
      kind: 'reserved',
      issue: { id: '11111111-1111-4111-8111-111111111111', issueCode: 'IO-ABCD-EFGH' },
    }),
    flagPaymentException: vi.fn().mockResolvedValue({ issueId: '11111111-1111-4111-8111-111111111111' }),
  });
  enqueueDesignIssueMock.mockResolvedValue({ messageId: 'design-message' });
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notification-message' });
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

test('safepay paid webhook preserves raw authentication evidence, mints one Issue, and queues design plus payment email', async () => {
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
  expect(createIssueServiceMock().reserveForPaidAttempt).toHaveBeenCalledWith('attempt-1');
  expect(enqueueDesignIssueMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(
    '11111111-1111-4111-8111-111111111111',
    'PAYMENT_RECEIVED',
  );
});

test('duplicate paid evidence can resume downstream queues without minting another Issue', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'duplicate', paymentAttemptId: 'attempt-1' }),
  });
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(enqueueDesignIssueMock).toHaveBeenCalledTimes(1);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledTimes(1);
});

test('signed refund flags the canonical Issue and never queues new design work', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'refunded', paymentAttemptId: 'attempt-1' }),
  });
  const issueService = createIssueServiceMock();
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(issueService.flagPaymentException).toHaveBeenCalledWith('attempt-1', 'PAYMENT_REFUNDED');
  expect(enqueueDesignIssueMock).not.toHaveBeenCalled();
  expect(enqueueIssueNotificationMock).not.toHaveBeenCalledWith(expect.anything(), 'PAYMENT_RECEIVED');
});

test('provider money exception flags an existing Issue instead of starting downstream work', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'exception', paymentAttemptId: 'attempt-1' }),
  });
  const issueService = createIssueServiceMock();
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(issueService.flagPaymentException).toHaveBeenCalledWith('attempt-1', 'PAYMENT_EXCEPTION');
  expect(enqueueDesignIssueMock).not.toHaveBeenCalled();
});

test('invalid authenticated webhook evidence is rejected and never triggers downstream work', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn(() => { throw new Error('Safepay webhook signature is invalid'); }),
  });
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'bad' },
  }));
  expect(response.status).toBe(401);
  expect(enqueueDesignIssueMock).not.toHaveBeenCalled();
  expect(enqueueIssueNotificationMock).not.toHaveBeenCalled();
});
