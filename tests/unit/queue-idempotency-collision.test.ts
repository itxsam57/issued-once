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
import { enqueueDesignIssue } from '@/server/design/designQueue';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';

afterEach(() => {
  vi.clearAllMocks();
});

test('design queue treats Vercel idempotency collision as already delivered', async () => {
  sendMock.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

  await expect(enqueueDesignIssue(issueId)).resolves.toBeUndefined();
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
