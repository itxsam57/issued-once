import { beforeEach, expect, test, vi } from 'vitest';

const {
  createPaymentServiceMock,
  reconcileTrackerMock,
  createIssueServiceMock,
  reserveForPaidAttemptMock,
  dispatchPaidIssueDesignMock,
  enqueueIssueNotificationMock,
  referralsAreEnabledMock,
  createReferralConversionServiceMock,
  recordPaidAttemptMock,
  enqueueReferralNotificationMock,
} = vi.hoisted(() => ({
  createPaymentServiceMock: vi.fn(),
  reconcileTrackerMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  reserveForPaidAttemptMock: vi.fn(),
  dispatchPaidIssueDesignMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
  referralsAreEnabledMock: vi.fn(),
  createReferralConversionServiceMock: vi.fn(),
  recordPaidAttemptMock: vi.fn(),
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
vi.mock('@/server/design/designDispatch', () => ({
  dispatchPaidIssueDesign: dispatchPaidIssueDesignMock,
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  referralsAreEnabled: referralsAreEnabledMock,
  createReferralConversionService: createReferralConversionServiceMock,
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({
  enqueueReferralNotification: enqueueReferralNotificationMock,
}));

import { GET as paymentReturn } from '@/app/payment/return/route';

beforeEach(() => {
  vi.clearAllMocks();
  reconcileTrackerMock.mockResolvedValue({ kind: 'paid', paymentAttemptId: 'attempt-paid' });
  createPaymentServiceMock.mockReturnValue({ reconcileTracker: reconcileTrackerMock });
  reserveForPaidAttemptMock.mockResolvedValue({
    kind: 'reserved',
    issue: { id: '11111111-1111-4111-8111-111111111111', issueCode: 'IO-ABCD-EFGH' },
  });
  createIssueServiceMock.mockReturnValue({ reserveForPaidAttempt: reserveForPaidAttemptMock });
  dispatchPaidIssueDesignMock.mockResolvedValue({ mode: 'HYBRID', queued: true, policyVersion: 1 });
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notification-message' });
  referralsAreEnabledMock.mockReturnValue(false);
  recordPaidAttemptMock.mockResolvedValue({ kind: 'not-referred' });
  createReferralConversionServiceMock.mockReturnValue({ recordPaidAttempt: recordPaidAttemptMock });
  enqueueReferralNotificationMock.mockResolvedValue({ messageId: 'referral-notification-message' });
});

test('Safepay return reconciles the returned tracker and finalizes a Reporter-proven paid attempt', async () => {
  const response = await paymentReturn(
    new Request('https://issuedonce.shop/payment/return?tracker=track_paid_return'),
  );

  expect(response.status).toBe(303);
  expect(reconcileTrackerMock).toHaveBeenCalledWith({ providerReference: 'track_paid_return' });
  expect(reserveForPaidAttemptMock).toHaveBeenCalledWith('attempt-paid');
  expect(dispatchPaidIssueDesignMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(
    '11111111-1111-4111-8111-111111111111',
    'PAYMENT_RECEIVED',
  );
});

test('Safepay return without a tracker remains side-effect free', async () => {
  const response = await paymentReturn(new Request('https://issuedonce.shop/payment/return'));

  expect(response.status).toBe(303);
  expect(reconcileTrackerMock).not.toHaveBeenCalled();
  expect(reserveForPaidAttemptMock).not.toHaveBeenCalled();
});
