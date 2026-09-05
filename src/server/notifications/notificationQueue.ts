import { createJobQueue } from '@/server/jobs/runtimeJobs';
import type { NotificationEventKey } from './NotificationRepository';

export const NOTIFICATION_QUEUE_TOPIC = 'issued-once-notifications';

export async function enqueueIssueNotification(
  issueId: string,
  eventKey: NotificationEventKey,
  attemptKey = 'initial',
) {
  return createJobQueue().enqueue({
    topic: NOTIFICATION_QUEUE_TOPIC,
    payload: { issueId, eventKey },
    idempotencyKey: `notify:${issueId}:${eventKey}:${attemptKey}`,
  });
}
