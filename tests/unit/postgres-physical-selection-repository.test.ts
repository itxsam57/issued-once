import { describe, expect, test, vi } from 'vitest';
import { PostgresPhysicalSelectionRepository } from '@/server/physical/PostgresPhysicalSelectionRepository';

describe('PostgresPhysicalSelectionRepository', () => {
  test('advances PROFILE_COMPLETE and persists the locked server product atomically', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]),
    };
    const repository = new PostgresPhysicalSelectionRepository(sql);
    const updatedAt = new Date('2026-08-18T06:10:00.000Z');

    await repository.selectObjectAndAdvance({
      experienceId: 'exp-1',
      expectedStage: 'PROFILE_COMPLETE',
      nextStage: 'OBJECT_SELECTED',
      object: 'hoodie',
      productSlug: 'mystery-hoodie',
      updatedAt,
    });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('UPDATE experiences');
    expect(String(statement)).toContain('INSERT INTO experience_physical_selection');
    expect(params).toEqual([
      'exp-1',
      'PROFILE_COMPLETE',
      'OBJECT_SELECTED',
      'hoodie',
      'mystery-hoodie',
      updatedAt,
    ]);
  });

  test('rejects a stale or repeated stage transition', async () => {
    const repository = new PostgresPhysicalSelectionRepository({
      query: vi.fn().mockResolvedValue([]),
    });

    await expect(
      repository.selectObjectAndAdvance({
        experienceId: 'exp-1',
        expectedStage: 'PROFILE_COMPLETE',
        nextStage: 'OBJECT_SELECTED',
        object: 'hoodie',
        productSlug: 'mystery-hoodie',
        updatedAt: new Date(),
      }),
    ).rejects.toThrow('Physical selection stage conflict');
  });
});
