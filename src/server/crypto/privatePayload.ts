import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedPayloadV1 = {
  version: 1;
  keyVersion: 'v1';
  iv: string;
  ciphertext: string;
  tag: string;
};

export type EncryptedPayloadV2 = {
  version: 1;
  keyVersion: 'v2';
  iv: string;
  ciphertext: string;
  tag: string;
};

export type EncryptedPayload = EncryptedPayloadV1 | EncryptedPayloadV2;

type KeyVersion = EncryptedPayload['keyVersion'];

function loadKey(version: KeyVersion): Buffer {
  const envName = version === 'v1' ? 'QUIZ_ENCRYPTION_KEY_V1' : 'QUIZ_ENCRYPTION_KEY_V2';
  const encoded = process.env[envName];
  if (!encoded) {
    throw new Error(`${envName} is required`);
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error(`${envName} must decode to exactly 32 bytes`);
  }

  return key;
}

export async function encryptPrivatePayload(value: unknown): Promise<EncryptedPayloadV2> {
  const key = loadKey('v2');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    keyVersion: 'v2',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export async function decryptPrivatePayload<T>(payload: EncryptedPayload): Promise<T> {
  if (payload.version !== 1 || (payload.keyVersion !== 'v1' && payload.keyVersion !== 'v2')) {
    throw new Error('Unsupported encrypted payload version');
  }

  const key = loadKey(payload.keyVersion);
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
