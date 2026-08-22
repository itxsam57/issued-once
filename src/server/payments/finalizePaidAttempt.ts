import { dispatchPaidIssueDesign } from '@/server/design/designDispatch';
import { createIssueService } from '@/server/issues/runtimeIssues';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';
import { enqueueReferralNotification } from '@/server/referrals/referralNotificationQueue';
import {
  createReferralConversionService,
  referralsAreEnabled,
} from '@/server/referrals/runtimeReferrals';

export async function finalizePaidAttempt(paymentAttemptId: string) {
  const issue = await createIssueService().reserveForPaidAttempt(paymentAttemptId);

  if (referralsAreEnabled()) {
    const referral = await createReferralConversionService().recordPaidAttempt({
      paymentAttemptId,
      issueId: issue.issue.id,
    });
    if (referral.kind !== 'not-referred') {
      await enqueueReferralNotification(referral.conversionId, 'SALE');
    }
  }

  await dispatchPaidIssueDesign(issue.issue.id);
  await enqueueIssueNotification(issue.issue.id, 'PAYMENT_RECEIVED');
  return issue.issue;
}
