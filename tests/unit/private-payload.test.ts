import { Buffer } from 'node:buffer';
import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { decryptPrivatePayload, encryptPrivatePayload } from '@/server/crypto/privatePayload';

const V1_KEY = Buffer.alloc(32, 7).toString('base64');
const V2_KEY = Buffer.alloc(32, 9).toString('base64');

function createV1Fixture(value: unknown) {
  const key = Buffer.from(V1_KEY, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    version: 1 as const,
    keyVersion: 'v1' as const,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

beforeEach(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = V1_KEY;
  process.env.QUIZ_ENCRYPTION_KEY_V2 = V2_KEY;
});

afterEach(() => {
  delete process.env.QUIZ_ENCRYPTION_KEY_V1;
  delete process.env.QUIZ_ENCRYPTION_KEY_V2;
});

test('new encrypted payloads use V2 and round-trip without plaintext exposure', async () => {
  const source = { q1: 'moths and maps', nested: ['private', 42] };
  const encrypted = await encryptPrivatePayload(source);

  expect(encrypted.keyVersion).toBe('v2');
  expect(JSON.stringify(encrypted)).not.toContain('moths and maps');
  expect(await decryptPrivatePayload(encrypted)).toEqual(source);
});

test('existing V1 ciphertext remains decryptable with the V1 key', async () => {
  const source = { answer: 'preserve this old answer' };
  const encrypted = createV1Fixture(source);

  expect(await decryptPrivatePayload(encrypted)).toEqual(source);
});

test('V1 decryption fails closed when the V1 key is unavailable even when V2 exists', async () => {
  delete process.env.QUIZ_ENCRYPTION_KEY_V1;

  await expect(decryptPrivatePayload(createV1Fixture({ answer: 'old' }))).rejects.toThrow(
    /QUIZ_ENCRYPTION_KEY_V1 is required/i,
  );
});

test('new encryption fails closed when the V2 key is unavailable', async () => {
  delete process.env.QUIZ_ENCRYPTION_KEY_V2;

  await expect(encryptPrivatePayload({ answer: 'new' })).rejects.toThrow(
    /QUIZ_ENCRYPTION_KEY_V2 is required/i,
  );
});

test('new encryption rejects malformed V2 key material', async () => {
  process.env.QUIZ_ENCRYPTION_KEY_V2 = Buffer.alloc(31, 9).toString('base64');

  await expect(encryptPrivatePayload({ answer: 'new' })).rejects.toThrow(
    /QUIZ_ENCRYPTION_KEY_V2 must decode to exactly 32 bytes/i,
  );
});
