import { Buffer } from 'node:buffer';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString('base64');
});

test('encrypted payload never contains plaintext and round-trips exactly', async () => {
  const source = { q1: 'moths and maps', nested: ['private', 42] };
  const encrypted = await encryptPrivatePayload(source);

  expect(JSON.stringify(encrypted)).not.toContain('moths and maps');
  expect(await decryptPrivatePayload(encrypted)).toEqual(source);
});
