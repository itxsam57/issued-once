import { describe, expect, test, vi } from 'vitest';
import { PostgresQuizEncryptionRotationRepository } from '@/server/crypto/PostgresQuizEncryptionRotationRepository';

const storedRow = {
  experience_id: 'exp-1',
  question_id: 'q1',
  payload_version: 1,
  key_version: 'v1',
  iv: 'old-iv',
  auth_tag: 'old-tag',
  ciphertext: 'old-ciphertext',
};

const source = {
  experienceId: 'exp-1',
  questionId: 'q1' as const,
  payloadVersion: 1 as const,
  keyVersion: 'v1' as const,
  iv: 'old-iv',
  tag: 'old-tag',
  ciphertext: 'old-ciphertext',
};

const v2 = {
  version: 1 as const,
  keyVersion: 'v2' as const,
  iv: 'new-iv',
  tag: 'new-tag',
  ciphertext: 'new-ciphertext',
};

describe('PostgresQuizEncryptionRotationRepository', () => {
  test('lists only V1 rows in deterministic bounded order', async () => {
    const query = vi.fn().mockResolvedValue([storedRow]);
    const repository = new PostgresQuizEncryptionRotationRepository({ query });

    const rows = await repository.listV1(100);

    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain("WHERE key_version = 'v1'");
    expect(sql).toContain('ORDER BY answered_at, experience_id, question_id');
    expect(sql).toContain('LIMIT $1');
    expect(params).toEqual([100]);
    expect(rows).toEqual([source]);
  });

  test('replaces exactly one matching V1 row with V2 using compare-and-swap', async () => {
    const query = vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]);
    const repository = new PostgresQuizEncryptionRotationRepository({ query });

    const replaced = await repository.replaceV1(source, v2);

    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('UPDATE experience_answers');
    expect(sql).toContain("key_version = 'v2'");
    expect(sql).toContain("AND key_version = 'v1'");
    expect(sql).toContain('RETURNING experience_id');
    expect(params).toEqual([
      'exp-1',
      'q1',
      1,
      'new-iv',
      'new-tag',
      'new-ciphertext',
    ]);
    expect(replaced).toBe(true);
  });

  test('returns false when the V1 row was already changed by another worker', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresQuizEncryptionRotationRepository({ query });

    expect(await repository.replaceV1(source, v2)).toBe(false);
  });

  test('counts remaining V1 rows without returning encrypted payload data', async () => {
    const query = vi.fn().mockResolvedValue([{ row_count: '1847' }]);
    const repository = new PostgresQuizEncryptionRotationRepository({ query });

    expect(await repository.countV1()).toBe(1847);
    const [sql] = query.mock.calls[0] ?? [];
    expect(sql).toContain("WHERE key_version = 'v1'");
    expect(sql).toContain('COUNT(*)');
    expect(sql).not.toContain('ciphertext');
  });
});
