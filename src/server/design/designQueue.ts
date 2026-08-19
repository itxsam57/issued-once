import { send } from '@vercel/queue';

export const DESIGN_QUEUE_TOPIC = 'issued-once-design';
export type DesignQueueMode = 'reinterpret' | 'regenerate';
export type DesignQueueSource = 'AUTOMATIC' | 'OWNER_REGENERATE' | 'OWNER_REINTERPRET';

export async function enqueueDesignIssue(
  issueId: string,
  options: { mode?: DesignQueueMode; generationKey?: string; source?: DesignQueueSource } = {},
) {
  const mode = options.mode ?? 'reinterpret';
  const generationKey = options.generationKey ?? 'initial';
  const source = options.source ?? 'AUTOMATIC';
  return send(
    DESIGN_QUEUE_TOPIC,
    { issueId, mode, generationKey, source },
    {
      idempotencyKey: `design:${issueId}:${generationKey}`,
      retentionSeconds: 7 * 24 * 60 * 60,
    },
  );
}
