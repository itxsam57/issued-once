import { Buffer } from 'node:buffer';
import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { QuizEncryptionRotationService } from '@/server/crypto/QuizEncryptionRotationService';
import type {
  QuizEncryptionRotationRepository,
  StoredQuizCiphertext,
} from '@/server/crypto/QuizEncryptionRotationRepository';
import type { EncryptedPayloadV2 } from '@/server/crypto/privatePayload';

const V1_KEY = Buffer.alloc(32, 41).toString('base64');
const V2_KEY = Buffer.alloc(32, 43).toString('base64');

function createV1Row(answer: unknown, overrides: Partial<StoredQuizCiphertext> = {}): StoredQuizCiphertext {
  const key = Buffer.from(V1_KEY, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(answer), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    experienceId: 'exp-1',
    questionId: 'q1',
    payloadVersion: 1,
    keyVersion: 'v1',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    ...overrides,
  };
}

class FakeRotationRepository implements QuizEncryptionRotationRepository {
  rows: StoredQuizCiphertext[];
  replaceResult = true;
  replacements: Array<{ source: StoredQuizCiphertext; encrypted: EncryptedPayloadV2 }> = [];

  constructor(rows: StoredQuizCiphertext[]) {
    this.rows = rows;
  }

  async listV1(limit: number): Promise<StoredQuizCiphertext[]> {
    return this.rows.slice(0, limit);
  }

  async replaceV1(source: StoredQuizCiphertext, encrypted: EncryptedPayloadV2): Promise<boolean> {
    this.replacements.push({ source, encrypted });
    if (!this.replaceResult) return false;
    this.rows = this.rows.filter(
      (row) => row.experienceId !== source.experienceId || row.questionId !== source.questionId,
    );
    return true;
  }

  async countV1(): Promise<number> {
    return this.rows.length;
  }
}

beforeEach(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = V1_KEY;
  process.env.QUIZ_ENCRYPTION_KEY_V2 = V2_KEY;
});

afterEach(() => {
  delete process.env.QUIZ_ENCRYPTION_KEY_V1;
  delete process.env.QUIZ_ENCRYPTION_KEY_V2;
});

describe('QuizEncryptionRotationService', () => {
  test('decrypts V1 only in memory, writes V2, and reports a bounded successful batch', async () => {
    const repository = new FakeRotationRepository([createV1Row({ answer: 'preserve me' })]);
    const service = new QuizEncryptionRotationService(repository);

    const result = await service.migrateBatch(100);

    expect(result).toEqual({ scanned: 1, migrated: 1, skipped: 0, failed: 0, remaining: 0 });
    expect(repository.replacements).toHaveLength(1);
    expect(repository.replacements[0]?.encrypted.keyVersion).toBe('v2');
    expect(JSON.stringify(repository.replacements[0]?.encrypted)).not.toContain('preserve me');
  });

  test('treats a compare-and-swap miss as skipped without destroying the V1 source', async () => {
    const repository = new FakeRotationRepository([createV1Row({ answer: 'race-safe' })]);
    repository.replaceResult = false;
    const service = new QuizEncryptionRotationService(repository);

    const result = await service.migrateBatch(1);

    expect(result).toEqual({ scanned: 1, migrated: 0, skipped: 1, failed: 0, remaining: 1 });
    expect(repository.rows).toHaveLength(1);
  });

  test('stops the batch on a decrypt failure and leaves that V1 row unchanged', async () => {
    const broken = createV1Row({ answer: 'must survive' }, { ciphertext: 'not-valid-ciphertext' });
    const later = createV1Row({ answer: 'do not reach this row' }, { experienceId: 'exp-2' });
    const repository = new FakeRotationRepository([broken, later]);
    const service = new QuizEncryptionRotationService(repository);

    const result = await service.migrateBatch(100);

    expect(result).toEqual({ scanned: 1, migrated: 0, skipped: 0, failed: 1, remaining: 2 });
    expect(repository.replacements).toHaveLength(0);
    expect(repository.rows).toEqual([broken, later]);
  });
});
