import { describe, expect, test, vi } from 'vitest';
import { PostgresJobQueue } from '@/server/jobs/PostgresJobQueue';

describe('PostgresJobQueue', () => {
  test('enqueues once and reports an idempotent duplicate without changing the payload', async () => {
    const sql = {
      query: vi.fn()
        .mockResolvedValueOnce([{ id: 'job-1', duplicate: false }])
        .mockResolvedValueOnce([{ id: 'job-1', duplicate: true }]),
    };
    const queue = new PostgresJobQueue(sql, () => 'job-1');
    const payload = { issueId: '11111111-1111-4111-8111-111111111111' };

    await expect(queue.enqueue({
      topic: 'issued-once-design',
      payload,
      idempotencyKey: 'design:issue-1:initial',
    })).resolves.toEqual({ id: 'job-1', duplicate: false });

    await expect(queue.enqueue({
      topic: 'issued-once-design',
      payload,
      idempotencyKey: 'design:issue-1:initial',
    })).resolves.toEqual({ id: 'job-1', duplicate: true });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('INSERT INTO background_jobs');
    expect(String(statement)).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
    expect(params).toEqual([
      'job-1',
      'issued-once-design',
      JSON.stringify(payload),
      'design:issue-1:initial',
      expect.any(Date),
    ]);
  });

  test('claims due jobs with row locking, a finite lease, and an attempt increment', async () => {
    const now = new Date('2026-08-23T12:30:00.000Z');
    const sql = {
      query: vi.fn().mockResolvedValue([{
        id: 'job-1',
        topic: 'issued-once-design',
        payload: { issueId: '11111111-1111-4111-8111-111111111111' },
        idempotency_key: 'design:issue-1:initial',
        attempts: 1,
        max_attempts: 6,
        lease_expires_at: new Date('2026-08-23T12:31:00.000Z'),
      }]),
    };
    const queue = new PostgresJobQueue(sql, () => 'unused');

    await expect(queue.claim({
      topics: ['issued-once-design', 'issued-once-notifications'],
      workerId: 'worker-a',
      limit: 8,
      leaseMs: 60_000,
      now,
    })).resolves.toEqual([{
      id: 'job-1',
      topic: 'issued-once-design',
      payload: { issueId: '11111111-1111-4111-8111-111111111111' },
      idempotencyKey: 'design:issue-1:initial',
      attempts: 1,
      maxAttempts: 6,
      leaseExpiresAt: new Date('2026-08-23T12:31:00.000Z'),
    }]);

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('FOR UPDATE SKIP LOCKED');
    expect(String(statement)).toContain("state = 'PROCESSING'");
    expect(String(statement)).toContain('attempts = attempts + 1');
    expect(params).toEqual([
      ['issued-once-design', 'issued-once-notifications'],
      now,
      8,
      'worker-a',
      new Date('2026-08-23T12:31:00.000Z'),
    ]);
  });

  test('only the lease owner can complete, retry, or terminally fail a job', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ id: 'job-1' }]) };
    const queue = new PostgresJobQueue(sql, () => 'unused');
    const retryAt = new Date('2026-08-23T12:40:00.000Z');

    await queue.complete('job-1', 'worker-a');
    await queue.retry('job-1', 'worker-a', { availableAt: retryAt, error: 'temporary' });
    await queue.fail('job-1', 'worker-a', 'permanent');

    expect(String(sql.query.mock.calls[0]?.[0])).toContain("state = 'COMPLETED'");
    expect(sql.query.mock.calls[0]?.[1]).toEqual(['job-1', 'worker-a']);

    expect(String(sql.query.mock.calls[1]?.[0])).toContain("state = 'PENDING'");
    expect(sql.query.mock.calls[1]?.[1]).toEqual(['job-1', 'worker-a', retryAt, 'temporary']);

    expect(String(sql.query.mock.calls[2]?.[0])).toContain("state = 'FAILED'");
    expect(sql.query.mock.calls[2]?.[1]).toEqual(['job-1', 'worker-a', 'permanent']);
  });
});
