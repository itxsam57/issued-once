import { afterEach, expect, test } from 'vitest';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import { OpsPrivateRevealService } from '@/server/ops/OpsPrivateRevealService';

const key = Buffer.alloc(32, 7).toString('base64');
const originalKey = process.env.QUIZ_ENCRYPTION_KEY_V1;
afterEach(() => { process.env.QUIZ_ENCRYPTION_KEY_V1 = originalKey; });

test('reveals only one requested category and audits without plaintext', async () => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = key;
  const contact = await encryptPrivatePayload({ email: 'private@example.com' });
  const audits: unknown[] = [];
  const service = new OpsPrivateRevealService({
    getContact: async () => contact,
    getShipping: async () => null,
    getAnswers: async () => [],
    getDesignBrief: async () => null,
    getSupportMessages: async () => [],
  }, {
    record: async (event: unknown) => { audits.push(event); },
  } as never);

  const revealed = await service.reveal({
    issueId: '11111111-1111-1111-1111-111111111111',
    category: 'contact',
    reason: 'customer asked about delivery',
  });

  expect(revealed).toEqual({ email: 'private@example.com' });
  expect(JSON.stringify(audits)).not.toContain('private@example.com');
  expect(JSON.stringify(audits)).toContain('contact');
});

test('rejects reveal without a human reason', async () => {
  const service = new OpsPrivateRevealService({
    getContact: async () => null,
    getShipping: async () => null,
    getAnswers: async () => [],
    getDesignBrief: async () => null,
    getSupportMessages: async () => [],
  }, { record: async () => undefined } as never);

  await expect(service.reveal({
    issueId: '11111111-1111-1111-1111-111111111111',
    category: 'shipping',
    reason: '   ',
  })).rejects.toThrow(/reason/i);
});
