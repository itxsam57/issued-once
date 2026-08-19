import { expect, test } from 'vitest';
import { OpsSupportService } from '@/server/ops/OpsSupportService';

test('closes a support case and audits the owner action without message plaintext', async () => {
  const audits: unknown[] = [];
  const service = new OpsSupportService({
    list: async () => [],
    setStatus: async () => ({ issueId: '11111111-1111-1111-1111-111111111111' }),
    addNote: async () => undefined,
    getReplyContext: async () => null,
    assertFailedNotification: async () => undefined,
  }, { send: async () => ({ providerMessageId: 'r1' }) }, { record: async (event) => { audits.push(event); } } as never, { enqueue: async () => undefined });
  await service.setStatus({ requestId: '22222222-2222-2222-2222-222222222222', status: 'CLOSED' });
  expect(JSON.stringify(audits)).toContain('SUPPORT_CLOSED');
  expect(JSON.stringify(audits)).not.toContain('message');
});

test('retries only a store-confirmed failed notification and audits the retry', async () => {
  const calls: unknown[] = [];
  const issueId = '11111111-1111-1111-1111-111111111111';
  const service = new OpsSupportService({
    list: async () => [],
    setStatus: async () => ({ issueId }),
    addNote: async () => undefined,
    getReplyContext: async () => null,
    assertFailedNotification: async (candidateIssueId, eventKey) => { calls.push({ candidateIssueId, eventKey }); },
  }, { send: async () => ({ providerMessageId: 'r1' }) }, { record: async (event) => { calls.push(event); } } as never, {
    enqueue: async (candidateIssueId, eventKey) => { calls.push({ queued: candidateIssueId, eventKey }); },
  });

  await service.retryNotification({ issueId, eventKey: 'SHIPPED' });

  expect(calls[0]).toEqual({ candidateIssueId: issueId, eventKey: 'SHIPPED' });
  expect(calls[1]).toEqual({ queued: issueId, eventKey: 'SHIPPED' });
  expect(JSON.stringify(calls)).toContain('NOTIFICATION_RETRY');
});
