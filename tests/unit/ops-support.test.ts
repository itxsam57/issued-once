import { expect, test } from 'vitest';
import { OpsSupportService } from '@/server/ops/OpsSupportService';

test('closes a support case and audits the owner action without message plaintext', async () => {
  const audits: unknown[] = [];
  const service = new OpsSupportService({
    list: async () => [],
    setStatus: async () => ({ issueId: '11111111-1111-1111-1111-111111111111' }),
    addNote: async () => undefined,
    getReplyContext: async () => null,
  }, { send: async () => ({ providerMessageId: 'r1' }) }, { record: async (event) => { audits.push(event); } } as never);
  await service.setStatus({ requestId: '22222222-2222-2222-2222-222222222222', status: 'CLOSED' });
  expect(JSON.stringify(audits)).toContain('SUPPORT_CLOSED');
  expect(JSON.stringify(audits)).not.toContain('message');
});
