import { describe, expect, test, vi } from 'vitest';
import { JobProcessor, PermanentJobError } from '@/server/jobs/JobProcessor';
import type { ClaimedJob, JobQueue } from '@/server/jobs/JobQueue';

function claimed(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    topic: 'issued-once-design',
    payload: { issueId: '11111111-1111-4111-8111-111111111111' },
    idempotencyKey: 'design:issue-1:initial',
    attempts: 1,
    maxAttempts: 6,
    leaseExpiresAt: new Date('2026-08-23T12:31:00.000Z'),
    ...overrides,
  };
}

function queueWith(jobs: ClaimedJob[]) {
  const queue: JobQueue = {
    enqueue: vi.fn(),
    claim: vi.fn().mockResolvedValue(jobs),
    complete: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
  return queue;
}

describe('JobProcessor', () => {
  test('completes successful jobs and reports bounded counts', async () => {
    const queue = queueWith([claimed()]);
    const handler = vi.fn().mockResolvedValue(undefined);
    const processor = new JobProcessor(queue, new Map([['issued-once-design', handler]]), {
      now: () => new Date('2026-08-23T12:30:00.000Z'),
    });

    await expect(processor.drain({
      topics: ['issued-once-design'],
      workerId: 'hostinger-cron-1',
      limit: 8,
    })).resolves.toEqual({ claimed: 1, completed: 1, retried: 0, failed: 0 });

    expect(handler).toHaveBeenCalledWith({ issueId: '11111111-1111-4111-8111-111111111111' });
    expect(queue.complete).toHaveBeenCalledWith('job-1', 'hostinger-cron-1');
  });

  test('retries transient failures with bounded exponential delay', async () => {
    const queue = queueWith([claimed({ attempts: 3 })]);
    const handler = vi.fn().mockRejectedValue(new Error('temporary provider failure'));
    const now = new Date('2026-08-23T12:30:00.000Z');
    const processor = new JobProcessor(queue, new Map([['issued-once-design', handler]]), { now: () => now });

    await expect(processor.drain({
      topics: ['issued-once-design'],
      workerId: 'hostinger-cron-1',
      limit: 8,
    })).resolves.toEqual({ claimed: 1, completed: 0, retried: 1, failed: 0 });

    expect(queue.retry).toHaveBeenCalledWith('job-1', 'hostinger-cron-1', {
      availableAt: new Date('2026-08-23T12:34:00.000Z'),
      error: 'temporary provider failure',
    });
  });

  test('terminally fails permanent payload errors and jobs at max attempts', async () => {
    const permanentQueue = queueWith([claimed()]);
    const permanent = new JobProcessor(
      permanentQueue,
      new Map([['issued-once-design', vi.fn().mockRejectedValue(new PermanentJobError('invalid payload'))]]),
    );
    await permanent.drain({ topics: ['issued-once-design'], workerId: 'worker-a', limit: 8 });
    expect(permanentQueue.fail).toHaveBeenCalledWith('job-1', 'worker-a', 'invalid payload');
    expect(permanentQueue.retry).not.toHaveBeenCalled();

    const exhaustedQueue = queueWith([claimed({ attempts: 6, maxAttempts: 6 })]);
    const exhausted = new JobProcessor(
      exhaustedQueue,
      new Map([['issued-once-design', vi.fn().mockRejectedValue(new Error('still failing'))]]),
    );
    await exhausted.drain({ topics: ['issued-once-design'], workerId: 'worker-b', limit: 8 });
    expect(exhaustedQueue.fail).toHaveBeenCalledWith('job-1', 'worker-b', 'still failing');
  });

  test('fails closed when a claimed topic has no registered handler', async () => {
    const queue = queueWith([claimed({ topic: 'unknown-topic' })]);
    const processor = new JobProcessor(queue, new Map());

    await expect(processor.drain({ topics: ['unknown-topic'], workerId: 'worker-a', limit: 8 }))
      .resolves.toEqual({ claimed: 1, completed: 0, retried: 0, failed: 1 });
    expect(queue.fail).toHaveBeenCalledWith('job-1', 'worker-a', 'No handler registered for topic unknown-topic');
  });
});
