import { send } from '@vercel/queue';
import type { NotificationEventKey } from './NotificationRepository';

export const NOTIFICATION_QUEUE_TOPIC = 'issued-once-notifications';

export async function enqueueIssueNotification(
  issueId: string,
  eventKey: NotificationEventKey,
  attemptKey = 'initial',
) {
  return send(
    NOTIFICATION_QUEUE_TOPIC,
    { issueId, eventKey },
    {
      idempotencyKey: `notify:${issueId}:${eventKey}:${attemptKey}`,
      retentionSeconds: 7 * 24 * 60 * 60,
    },
  );
}
