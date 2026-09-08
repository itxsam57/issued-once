import { afterEach, expect, test, vi } from 'vitest';

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));

vi.mock('@/server/jobs/runtimeJobs', () => ({
  createJobQueue: () => ({ enqueue }),
}));

import { DESIGN_QUEUE_TOPIC, enqueueDesignIssue } from '@/server/design/designQueue';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';

afterEach(() => {
  vi.clearAllMocks();
});

test('design queue treats an idempotency collision as already accepted', async () => {
  enqueue.mockResolvedValueOnce({ id: 'existing-design-job', duplicate: true });
  await expect(enqueueDesignIssue(issueId)).resolves.toEqual({
    id: 'existing-design-job',
    duplicate: true,
  });
});

test('design queue carries bounded owner revision feedback in the internal message', async () => {
  enqueue.mockResolvedValueOnce({ id: 'design-job', duplicate: false });

  await enqueueDesignIssue(issueId, {
    mode: 'regenerate',
    generationKey: 'gen-2',
    source: 'OWNER_REGENERATE',
    feedback: 'TOO BUSY — simplify the center and leave more negative space',
  });

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

test('notification queue treats an idempotency collision as already accepted', async () => {
  enqueue.mockResolvedValueOnce({ id: 'existing-notification-job', duplicate: true });
  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED')).resolves.toEqual({
    id: 'existing-notification-job',
    duplicate: true,
  });
});

test('queue publishers still surface real delivery failures', async () => {
  enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueDesignIssue(issueId)).rejects.toThrow('queue unavailable');

  enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED')).rejects.toThrow('queue unavailable');
});
