import type { JobPayload, JobQueue } from './JobQueue';

export type JobHandler = (payload: JobPayload) => Promise<void>;

export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export type DrainResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 1000);
  return 'Background job failed';
}

function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts));
}

export class JobProcessor {
  constructor(
    private readonly queue: JobQueue,
    private readonly handlers: ReadonlyMap<string, JobHandler>,
    private readonly options: { now?: () => Date; leaseMs?: number } = {},
  ) {}

  async drain(input: { topics: string[]; workerId: string; limit: number }): Promise<DrainResult> {
    const now = this.options.now?.() ?? new Date();
    const jobs = await this.queue.claim({
      topics: input.topics,
      workerId: input.workerId,
      limit: input.limit,
      leaseMs: this.options.leaseMs ?? 10 * 60 * 1000,
      now,
    });
    const result: DrainResult = { claimed: jobs.length, completed: 0, retried: 0, failed: 0 };

    for (const job of jobs) {
      const handler = this.handlers.get(job.topic);
      if (!handler) {
        await this.queue.fail(job.id, input.workerId, `No handler registered for topic ${job.topic}`);
        result.failed += 1;
        continue;
      }

      try {
        await handler(job.payload);
        await this.queue.complete(job.id, input.workerId);
        result.completed += 1;
      } catch (error) {
        const message = errorMessage(error);
        if (error instanceof PermanentJobError || job.attempts >= job.maxAttempts) {
          await this.queue.fail(job.id, input.workerId, message);
          result.failed += 1;
          continue;
        }
        await this.queue.retry(job.id, input.workerId, {
          availableAt: new Date(now.getTime() + retryDelayMs(job.attempts)),
          error: message,
        });
        result.retried += 1;
      }
    }

    return result;
  }
}
