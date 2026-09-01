import { beforeEach, expect, test, vi } from 'vitest';

const {
  flagPaymentExceptionMock,
  createIssueServiceMock,
  referralsAreEnabledMock,
  createReferralConversionServiceMock,
  reverseRefundedAttemptMock,
  enqueueReferralNotificationMock,
} = vi.hoisted(() => ({
  flagPaymentExceptionMock: vi.fn(),
  createIssueServiceMock: vi.fn(),
  referralsAreEnabledMock: vi.fn(),
  createReferralConversionServiceMock: vi.fn(),
  reverseRefundedAttemptMock: vi.fn(),
  enqueueReferralNotificationMock: vi.fn(),
}));

vi.mock('@/server/issues/runtimeIssues', () => ({ createIssueService: createIssueServiceMock }));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  referralsAreEnabled: referralsAreEnabledMock,
  createReferralConversionService: createReferralConversionServiceMock,
}));
vi.mock('@/server/referrals/referralNotificationQueue', () => ({
  enqueueReferralNotification: enqueueReferralNotificationMock,
}));

import { finalizeRefundedAttempt } from '@/server/payments/finalizeRefundedAttempt';

beforeEach(() => {
  vi.clearAllMocks();
  flagPaymentExceptionMock.mockResolvedValue(true);
  createIssueServiceMock.mockReturnValue({ flagPaymentException: flagPaymentExceptionMock });
  reverseRefundedAttemptMock.mockResolvedValue({
    kind: 'updated', conversionId: 'conversion-1', creatorId: 'creator-1',
    rewardAmountMinor: 500, currency: 'USD', state: 'REVERSED',
  });
  createReferralConversionServiceMock.mockReturnValue({ reverseRefundedAttempt: reverseRefundedAttemptMock });
  enqueueReferralNotificationMock.mockResolvedValue(undefined);
});

test('always quarantines the Issue and skips referral SQL before referral rollout', async () => {
  referralsAreEnabledMock.mockReturnValue(false);

  await finalizeRefundedAttempt('attempt-refund');

  expect(flagPaymentExceptionMock).toHaveBeenCalledWith('attempt-refund', 'PAYMENT_REFUNDED');
  expect(createReferralConversionServiceMock).not.toHaveBeenCalled();
  expect(reverseRefundedAttemptMock).not.toHaveBeenCalled();
  expect(enqueueReferralNotificationMock).not.toHaveBeenCalled();
});

test('reverses an enabled referral conversion and queues its reversal notice', async () => {
  referralsAreEnabledMock.mockReturnValue(true);

  await finalizeRefundedAttempt('attempt-refund');

  expect(flagPaymentExceptionMock).toHaveBeenCalledWith('attempt-refund', 'PAYMENT_REFUNDED');
  expect(reverseRefundedAttemptMock).toHaveBeenCalledWith('attempt-refund');
  expect(enqueueReferralNotificationMock).toHaveBeenCalledWith('conversion-1', 'REVERSAL');
});
