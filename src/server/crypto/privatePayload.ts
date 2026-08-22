import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedPayload = {
  version: 1;
  keyVersion: 'v1';
  iv: string;
  ciphertext: string;
  tag: string;
};

function loadKey(): Buffer {
  const encoded = process.env.QUIZ_ENCRYPTION_KEY_V1;
  if (!encoded) {
    throw new Error('QUIZ_ENCRYPTION_KEY_V1 is required');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('QUIZ_ENCRYPTION_KEY_V1 must decode to exactly 32 bytes');
  }

  return key;
}

export async function encryptPrivatePayload(value: unknown): Promise<EncryptedPayload> {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    keyVersion: 'v1',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export async function decryptPrivatePayload<T>(payload: EncryptedPayload): Promise<T> {
  if (payload.version !== 1 || payload.keyVersion !== 'v1') {
    throw new Error('Unsupported encrypted payload version');
  }

  const key = loadKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8')) as T;
}
