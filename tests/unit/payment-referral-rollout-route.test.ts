import { beforeEach, expect, test, vi } from 'vitest';

const {
  createPaymentServiceMock,
  createIssueServiceMock,
  createReferralConversionServiceMock,
  referralsAreEnabledMock,
  recordPaidReferralMock,
  reverseRefundedReferralMock,
  flagPaymentExceptionMock,
  dispatchPaidIssueDesignMock,
  enqueueIssueNotificationMock,
  enqueueReferralNotificationMock,
} = vi.hoisted(() => ({
  createPaymentServiceMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  createReferralConversionServiceMock: vi.fn(),
  referralsAreEnabledMock: vi.fn(),
  recordPaidReferralMock: vi.fn(),
  reverseRefundedReferralMock: vi.fn(),
  flagPaymentExceptionMock: vi.fn(),
  dispatchPaidIssueDesignMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
  enqueueReferralNotificationMock: vi.fn(),
}));

vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/issues/runtimeIssues', () => ({
  createIssueService: createIssueServiceMock,
  IssueRuntimeUnavailableError: class IssueRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  createReferralConversionService: createReferralConversionServiceMock,
  referralsAreEnabled: referralsAreEnabledMock,
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/design/designDispatch', () => ({ dispatchPaidIssueDesign: dispatchPaidIssueDesignMock }));
vi.mock('@/server/notifications/notificationQueue', () => ({ enqueueIssueNotification: enqueueIssueNotificationMock }));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({ enqueueReferralNotification: enqueueReferralNotificationMock }));

import { POST as safepayWebhook } from '@/app/api/webhooks/safepay/route';

const issueId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  referralsAreEnabledMock.mockReturnValue(false);
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-plain' }),
  });
  createIssueServiceMock.mockReturnValue({
    reserveForPaidAttempt: vi.fn().mockResolvedValue({
      kind: 'reserved',
      issue: { id: issueId, issueCode: 'IO-ABCD-EFGH' },
    }),
    flagPaymentException: flagPaymentExceptionMock,
  });
  recordPaidReferralMock.mockResolvedValue({ kind: 'not-referred' });
  reverseRefundedReferralMock.mockResolvedValue({ kind: 'not-referred' });
  createReferralConversionServiceMock.mockReturnValue({
    recordPaidAttempt: recordPaidReferralMock,
    reverseRefundedAttempt: reverseRefundedReferralMock,
  });
  dispatchPaidIssueDesignMock.mockResolvedValue({ mode: 'HYBRID', queued: true, policyVersion: 1 });
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notification-message' });
});

test('paid webhook skips referral SQL before referral rollout while preserving the core Issue and design flow', async () => {
  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST',
    body: '{}',
    headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(referralsAreEnabledMock).toHaveBeenCalledTimes(1);
  expect(createReferralConversionServiceMock).not.toHaveBeenCalled();
  expect(recordPaidReferralMock).not.toHaveBeenCalled();
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith(issueId);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(issueId, 'PAYMENT_RECEIVED');
  expect(enqueueReferralNotificationMock).not.toHaveBeenCalled();
});

test('refund webhook skips referral SQL before referral rollout while preserving the core refund flag', async () => {
  createPaymentServiceMock.mockReturnValue({
    handleWebhook: vi.fn().mockResolvedValue({ kind: 'refunded', paymentAttemptId: 'attempt-refund' }),
  });

  const response = await safepayWebhook(new Request('https://issuedonce.shop/api/webhooks/safepay', {
    method: 'POST',
    body: '{}',
    headers: { 'x-sfpy-signature': 'abc' },
  }));

  expect(response.status).toBe(200);
  expect(flagPaymentExceptionMock).toHaveBeenCalledWith('attempt-refund', 'PAYMENT_REFUNDED');
  expect(referralsAreEnabledMock).toHaveBeenCalledTimes(1);
  expect(createReferralConversionServiceMock).not.toHaveBeenCalled();
  expect(reverseRefundedReferralMock).not.toHaveBeenCalled();
  expect(enqueueReferralNotificationMock).not.toHaveBeenCalled();
});
