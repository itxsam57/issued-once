import { createJobQueue } from '@/server/jobs/runtimeJobs';
import { NOTIFICATION_QUEUE_TOPIC } from '@/server/notifications/notificationQueue';
import type { ReferralNotificationKind } from './ReferralRepository';

export async function enqueueReferralNotification(
  conversionId: string,
  kind: ReferralNotificationKind,
  attemptKey = 'initial',
) {
  return createJobQueue().enqueue({
    topic: NOTIFICATION_QUEUE_TOPIC,
    payload: { referralConversionId: conversionId, referralEventKey: kind },
    idempotencyKey: `referral-notify:${conversionId}:${kind}:${attemptKey}`,
  });
}
