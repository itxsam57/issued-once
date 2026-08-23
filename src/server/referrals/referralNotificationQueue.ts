import { DuplicateMessageError, send } from '@vercel/queue';
import { NOTIFICATION_QUEUE_TOPIC } from '@/server/notifications/notificationQueue';
import type { ReferralNotificationKind } from './ReferralRepository';

export async function enqueueReferralNotification(
  conversionId: string,
  kind: ReferralNotificationKind,
  attemptKey = 'initial',
) {
  try {
    return await send(
      NOTIFICATION_QUEUE_TOPIC,
      { referralConversionId: conversionId, referralEventKey: kind },
      {
        idempotencyKey: `referral-notify:${conversionId}:${kind}:${attemptKey}`,
        retentionSeconds: 7 * 24 * 60 * 60,
      },
    );
  } catch (error) {
    if (error instanceof DuplicateMessageError) return undefined;
    throw error;
  }
}
