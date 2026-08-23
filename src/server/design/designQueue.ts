import { createJobQueue } from '@/server/jobs/runtimeJobs';

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
  const payload = feedback
    ? { issueId, mode, generationKey, source, feedback }
    : { issueId, mode, generationKey, source };
  return createJobQueue().enqueue({
    topic: DESIGN_QUEUE_TOPIC,
    payload,
    idempotencyKey: `design:${issueId}:${generationKey}`,
  });
}
