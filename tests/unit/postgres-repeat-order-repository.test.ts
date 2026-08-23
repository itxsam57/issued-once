import { describe, expect, it } from 'vitest';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import { PostgresRepeatOrderRepository } from '@/server/experience/PostgresRepeatOrderRepository';

class RecordingSql implements SqlExecutor {
  readonly calls: Array<{ text: string; params?: readonly unknown[] }> = [];

  constructor(private readonly rows: Array<Record<string, unknown>>) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<Row[]> {
    this.calls.push({ text, params });
    return this.rows as Row[];
  }
}

const baseInput = {
  sourceExperienceId: 'source-exp',
  childExperienceId: 'child-exp',
  childSessionHash: 'a'.repeat(64),
  requestedMode: 'reuse' as const,
  createdAt: new Date('2026-08-23T03:00:00.000Z'),
  expiresAt: new Date('2026-09-22T03:00:00.000Z'),
};

describe('PostgresRepeatOrderRepository', () => {
  it('resolves a reuse child in one atomic SQL statement and verifies all seven copied profile records', async () => {
    const sql = new RecordingSql([
      {
        experience_id: 'child-exp',
        stage: 'PROFILE_COMPLETE',
        hook_id: 'repeat:reuse',
        created: true,
        answer_count: 7,
        question_count: 7,
      },
    ]);

    const result = await new PostgresRepeatOrderRepository(sql).resolve(baseInput);

    expect(result).toEqual({
      experienceId: 'child-exp',
      mode: 'reuse',
      stage: 'PROFILE_COMPLETE',
      created: true,
    });
    expect(sql.calls).toHaveLength(1);
    expect(sql.calls[0].text).toContain('ON CONFLICT (public_session_hash) DO NOTHING');
    expect(sql.calls[0].text).toContain('experience_answers');
    expect(sql.calls[0].text).toContain('experience_question_sets');
    expect(sql.calls[0].text).toContain('experience_question_set_items');
    expect(sql.calls[0].text).toContain('hook_id');
  });

  it('returns the stored winning mode when the deterministic child already exists', async () => {
    const sql = new RecordingSql([
      {
        experience_id: 'child-exp',
        stage: 'QUESTION_1',
        hook_id: 'repeat:fresh',
        created: false,
        answer_count: 0,
        question_count: 0,
      },
    ]);

    const result = await new PostgresRepeatOrderRepository(sql).resolve(baseInput);

    expect(result).toEqual({
      experienceId: 'child-exp',
      mode: 'fresh',
      stage: 'QUESTION_1',
      created: false,
    });
  });

  it('rejects a newly-created reuse child unless all seven encrypted answers and question snapshots were copied', async () => {
    const sql = new RecordingSql([
      {
        experience_id: 'child-exp',
        stage: 'PROFILE_COMPLETE',
        hook_id: 'repeat:reuse',
        created: true,
        answer_count: 6,
        question_count: 7,
      },
    ]);

    await expect(new PostgresRepeatOrderRepository(sql).resolve(baseInput)).rejects.toThrow(
      'Repeat profile copy is incomplete',
    );
  });
});
