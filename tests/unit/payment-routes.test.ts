import { beforeEach, expect, test, vi } from 'vitest';

const {
  cookiesMock,
  createPaymentServiceMock,
  createIssueServiceMock,
  dispatchPaidIssueDesignMock,
  enqueueIssueNotificationMock,
  createReferralConversionServiceMock,
  recordPaidReferralMock,
  enqueueReferralNotificationMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  dispatchPaidIssueDesignMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
  createReferralConversionServiceMock: vi.fn(),
  recordPaidReferralMock: vi.fn(),
  enqueueReferralNotificationMock: vi.fn(),
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
vi.mock('@/server/design/designDispatch', () => ({
  dispatchPaidIssueDesign: dispatchPaidIssueDesignMock,
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  createReferralConversionService: createReferralConversionServiceMock,
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({
  enqueueReferralNotification: enqueueReferralNotificationMock,
}));

import { POST as createPayment } from '@/app/api/payments/create/route';
import { POST as safepayWebhook } from '@/app/api/webhooks/safepay/route';

const issueId = '11111111-1111-4111-8111-111111111111';
const conversionId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: 'session-token' }) });
  createIssueServiceMock.mockReturnValue({
    reserveForPaidAttempt: vi.fn().mockResolvedValue({
      kind: 'reserved',
      issue: { id: issueId, issueCode: 'IO-ABCD-EFGH' },
    }),
    flagPaymentException: vi.fn().mockResolvedValue({ issueId }),
  });
  dispatchPaidIssueDesignMock.mockResolvedValue({ mode: 'HYBRID', queued: true, policyVersion: 1 });
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notification-message' });
  recordPaidReferralMock.mockResolvedValue({ kind: 'not-referred' });
  createReferralConversionServiceMock.mockReturnValue({ recordPaidAttempt: recordPaidReferralMock });
  enqueueReferralNotificationMock.mockResolvedValue({ messageId: 'referral-notification-message' });
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

test('safepay paid webhook preserves raw authentication evidence, mints one Issue, records referral conversion, and dispatches downstream work', async () => {
  const handleWebhook = vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-1' });
  createPaymentServiceMock.mockReturnValue({ handleWebhook });
  recordPaidReferralMock.mockResolvedValue({
    kind: 'created',
    conversionId,
    creatorId: '33333333-3333-4333-8333-333333333333',
    rewardAmountMinor: 972,
    currency: 'USD',
  });
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
  expect(recordPaidReferralMock).toHaveBeenCalledWith({
    paymentAttemptId: 'attempt-1',
    issueId,
  });
  expect(enqueueReferralNotificationMock).toHaveBeenCalledWith(conversionId, 'SALE');
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith(issueId);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(issueId, 'PAYMENT_RECEIVED');
});

test('duplicate paid evidence resumes referral notification recovery without minting another conversion or Issue', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'duplicate', paymentAttemptId: 'attempt-1' }),
  });
  recordPaidReferralMock.mockResolvedValue({
    kind: 'duplicate',
    conversionId,
    creatorId: '33333333-3333-4333-8333-333333333333',
    rewardAmountMinor: 972,
    currency: 'USD',
  });
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(recordPaidReferralMock).toHaveBeenCalledWith({ paymentAttemptId: 'attempt-1', issueId });
  expect(enqueueReferralNotificationMock).toHaveBeenCalledWith(conversionId, 'SALE');
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledTimes(1);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledTimes(1);
});

test('non-referred paid truth continues normal Issue flow without creator notification', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-plain' }),
  });
  recordPaidReferralMock.mockResolvedValue({ kind: 'not-referred' });

  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(recordPaidReferralMock).toHaveBeenCalledWith({ paymentAttemptId: 'attempt-plain', issueId });
  expect(enqueueReferralNotificationMock).not.toHaveBeenCalled();
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith(issueId);
});

test('signed refund flags the canonical Issue and never dispatches new design work', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'refunded', paymentAttemptId: 'attempt-1' }),
  });
  const issueService = createIssueServiceMock();
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(issueService.flagPaymentException).toHaveBeenCalledWith('attempt-1', 'PAYMENT_REFUNDED');
  expect(recordPaidReferralMock).not.toHaveBeenCalled();
  expect(dispatchPaidIssueDesignMock).not.toHaveBeenCalled();
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
  expect(recordPaidReferralMock).not.toHaveBeenCalled();
  expect(dispatchPaidIssueDesignMock).not.toHaveBeenCalled();
});

test('invalid authenticated webhook evidence is rejected and never triggers downstream work', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn(() => { throw new Error('Safepay webhook signature is invalid'); }),
  });
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST', body: '{}', headers: { 'x-sfpy-signature': 'bad' },
  }));
  expect(response.status).toBe(401);
  expect(recordPaidReferralMock).not.toHaveBeenCalled();
  expect(enqueueReferralNotificationMock).not.toHaveBeenCalled();
  expect(dispatchPaidIssueDesignMock).not.toHaveBeenCalled();
  expect(enqueueIssueNotificationMock).not.toHaveBeenCalled();
});
