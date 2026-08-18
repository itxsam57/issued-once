import { send } from '@vercel/queue';

export const DESIGN_QUEUE_TOPIC = 'issued-once-design';

export async function enqueueDesignIssue(issueId: string) {
  return send(
    DESIGN_QUEUE_TOPIC,
    { issueId },
    {
      idempotencyKey: `design:${issueId}`,
      retentionSeconds: 7 * 24 * 60 * 60,
    },
  );
}
