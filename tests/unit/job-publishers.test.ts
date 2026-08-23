import { afterEach, expect, test, vi } from 'vitest';

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));

vi.mock('@/server/jobs/runtimeJobs', () => ({
  createJobQueue: () => ({ enqueue }),
}));

import { DESIGN_QUEUE_TOPIC, enqueueDesignIssue } from '@/server/design/designQueue';
import { NOTIFICATION_QUEUE_TOPIC, enqueueIssueNotification } from '@/server/notifications/notificationQueue';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';

afterEach(() => {
  vi.clearAllMocks();
});

test('design publisher writes the existing payload and idempotency key to the provider-neutral queue', async () => {
  enqueue.mockResolvedValueOnce({ id: 'job-1', duplicate: false });

  await expect(enqueueDesignIssue(issueId, {
    mode: 'regenerate',
    generationKey: 'gen-2',
    source: 'OWNER_REGENERATE',
    feedback: 'TOO BUSY — simplify the center and leave more negative space',
  })).resolves.toEqual({ id: 'job-1', duplicate: false });

  expect(enqueue).toHaveBeenCalledWith({
    topic: DESIGN_QUEUE_TOPIC,
    payload: {
      issueId,
      mode: 'regenerate',
      generationKey: 'gen-2',
      source: 'OWNER_REGENERATE',
      feedback: 'TOO BUSY — simplify the center and leave more negative space',
    },
    idempotencyKey: `design:${issueId}:gen-2`,
  });
});

test('notification publisher writes the existing payload and idempotency key to the provider-neutral queue', async () => {
  enqueue.mockResolvedValueOnce({ id: 'job-2', duplicate: false });

  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED', 'retry-2')).resolves.toEqual({
    id: 'job-2',
    duplicate: false,
  });

  expect(enqueue).toHaveBeenCalledWith({
    topic: NOTIFICATION_QUEUE_TOPIC,
    payload: { issueId, eventKey: 'PAYMENT_RECEIVED' },
    idempotencyKey: `notify:${issueId}:PAYMENT_RECEIVED:retry-2`,
  });
});

test('a duplicate is a successful idempotent publish and real queue failures still surface', async () => {
  enqueue.mockResolvedValueOnce({ id: 'job-existing', duplicate: true });
  await expect(enqueueDesignIssue(issueId)).resolves.toEqual({ id: 'job-existing', duplicate: true });

  enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED')).rejects.toThrow('queue unavailable');
});
