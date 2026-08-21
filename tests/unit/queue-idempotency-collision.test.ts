import { afterEach, expect, test, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@vercel/queue', () => {
  class DuplicateMessageError extends Error {
    constructor(message = 'duplicate message') {
      super(message);
      this.name = 'DuplicateMessageError';
    }
  }

  return {
    send: sendMock,
    DuplicateMessageError,
  };
});

import { DuplicateMessageError } from '@vercel/queue';
import { DESIGN_QUEUE_TOPIC, enqueueDesignIssue } from '@/server/design/designQueue';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';

afterEach(() => {
  vi.clearAllMocks();
});

test('design queue treats Vercel idempotency collision as already delivered', async () => {
  sendMock.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

  await expect(enqueueDesignIssue(issueId)).resolves.toBeUndefined();
});

test('design queue carries bounded owner revision feedback in the internal message', async () => {
  sendMock.mockResolvedValueOnce(undefined);

  await enqueueDesignIssue(issueId, {
    mode: 'regenerate',
    generationKey: 'gen-2',
    source: 'OWNER_REGENERATE',
    feedback: 'TOO BUSY — simplify the center and leave more negative space',
  });

  expect(sendMock).toHaveBeenCalledWith(
    DESIGN_QUEUE_TOPIC,
    {
      issueId,
      mode: 'regenerate',
      generationKey: 'gen-2',
      source: 'OWNER_REGENERATE',
      feedback: 'TOO BUSY — simplify the center and leave more negative space',
    },
    {
      idempotencyKey: `design:${issueId}:gen-2`,
      retentionSeconds: 7 * 24 * 60 * 60,
    },
  );
});

test('notification queue treats Vercel idempotency collision as already delivered', async () => {
  sendMock.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED')).resolves.toBeUndefined();
});

test('queue publishers still surface real delivery failures', async () => {
  sendMock.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueDesignIssue(issueId)).rejects.toThrow('queue unavailable');

  sendMock.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED')).rejects.toThrow('queue unavailable');
});
