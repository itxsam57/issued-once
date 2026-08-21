import { DuplicateMessageError, send } from '@vercel/queue';

export const DESIGN_QUEUE_TOPIC = 'issued-once-design';
export type DesignQueueMode = 'reinterpret' | 'regenerate';
export type DesignQueueSource = 'AUTOMATIC' | 'OWNER_REGENERATE' | 'OWNER_REINTERPRET';

export async function enqueueDesignIssue(
  issueId: string,
  options: {
    mode?: DesignQueueMode;
    generationKey?: string;
    source?: DesignQueueSource;
    feedback?: string;
  } = {},
) {
  const mode = options.mode ?? 'reinterpret';
  const generationKey = options.generationKey ?? 'initial';
  const source = options.source ?? 'AUTOMATIC';
  const feedback = options.feedback?.trim();
  const message = feedback
    ? { issueId, mode, generationKey, source, feedback }
    : { issueId, mode, generationKey, source };
  try {
    return await send(
      DESIGN_QUEUE_TOPIC,
      message,
      {
        idempotencyKey: `design:${issueId}:${generationKey}`,
        retentionSeconds: 7 * 24 * 60 * 60,
      },
    );
  } catch (error) {
    if (error instanceof DuplicateMessageError) return undefined;
    throw error;
  }
}
