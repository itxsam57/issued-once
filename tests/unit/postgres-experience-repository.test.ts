import { describe, expect, test, vi } from 'vitest';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';

const record = {
  id: 'exp-1',
  publicSessionHash: 'hash-1',
  stage: 'q1' as const,
  hookId: 'public-entry',
  createdAt: new Date('2026-08-18T06:00:00.000Z'),
  updatedAt: new Date('2026-08-18T06:00:00.000Z'),
  expiresAt: new Date('2026-08-19T06:00:00.000Z'),
};

describe('PostgresExperienceRepository', () => {
  test('creates and reads an anonymous experience without storing a raw browser token', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: record.id,
          public_session_hash: record.publicSessionHash,
          stage: record.stage,
          hook_id: record.hookId,
          created_at: record.createdAt,
          updated_at: record.updatedAt,
          expires_at: record.expiresAt,
        },
      ]);

    const repository = new PostgresExperienceRepository({ query });
    await repository.create(record);
    const found = await repository.findBySessionHash(record.publicSessionHash);

    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO experiences');
    expect(query.mock.calls[0]?.[1]).toEqual([
      record.id,
      record.publicSessionHash,
      record.stage,
      record.hookId,
      record.createdAt,
      record.updatedAt,
      record.expiresAt,
    ]);
    expect(query.mock.calls[1]?.[0]).toContain('WHERE public_session_hash = $1');
    expect(found).toEqual(record);
  });

  test('writes encrypted answer and advances stage in one compare-and-swap statement', async () => {
    const query = vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]);
    const repository = new PostgresExperienceRepository({ query });

    await repository.saveAnswerAndAdvance({
      answer: {
        experienceId: 'exp-1',
        questionId: 'q1',
        encryptedPayload: {
          version: 1,
          algorithm: 'AES-256-GCM',
          keyId: 'quiz-v1',
          iv: 'iv',
          tag: 'tag',
          ciphertext: 'ciphertext',
        },
        answeredAt: new Date('2026-08-18T06:01:00.000Z'),
      },
      expectedStage: 'q1',
      nextStage: 'q2',
      updatedAt: new Date('2026-08-18T06:01:00.000Z'),
    });

    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('WITH advanced AS');
    expect(sql).toContain('stage = $3');
    expect(sql).toContain('AND stage = $2');
    expect(sql).toContain('INSERT INTO experience_answers');
    expect(params).toContain('ciphertext');
  });

  test('rejects a stale or duplicate transition when expected stage no longer matches', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PostgresExperienceRepository({ query });

    await expect(
      repository.saveAnswerAndAdvance({
        answer: {
          experienceId: 'exp-1',
          questionId: 'q1',
          encryptedPayload: {
            version: 1,
            algorithm: 'AES-256-GCM',
            keyId: 'quiz-v1',
            iv: 'iv',
            tag: 'tag',
            ciphertext: 'ciphertext',
          },
          answeredAt: new Date('2026-08-18T06:01:00.000Z'),
        },
        expectedStage: 'q1',
        nextStage: 'q2',
        updatedAt: new Date('2026-08-18T06:01:00.000Z'),
      }),
    ).rejects.toThrow('Experience stage conflict');
  });
});
