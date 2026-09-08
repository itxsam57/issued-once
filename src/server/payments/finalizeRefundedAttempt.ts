import { createIssueService } from '@/server/issues/runtimeIssues';
import { enqueueReferralNotification } from '@/server/referrals/referralNotificationQueue';
import {
  createReferralConversionService,
  referralsAreEnabled,
} from '@/server/referrals/runtimeReferrals';

export async function finalizeRefundedAttempt(paymentAttemptId: string) {
  await createIssueService().flagPaymentException(paymentAttemptId, 'PAYMENT_REFUNDED');

  if (!referralsAreEnabled()) return;

  const referral = await createReferralConversionService().reverseRefundedAttempt(paymentAttemptId);
  if (referral.kind !== 'not-referred') {
    await enqueueReferralNotification(referral.conversionId, 'REVERSAL');
  }
}
