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

  test('reads the private locked physical record by experience id', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([
        {
          experience_id: 'exp-1',
          object_type: 'hoodie',
          product_slug: 'mystery-hoodie',
          size_code: null,
          color_code: null,
          color_label: null,
          color_swatch: null,
          variant_id: null,
          updated_at: new Date('2026-08-18T06:10:00.000Z'),
        },
      ]),
    };
    const repository = new PostgresPhysicalSelectionRepository(sql);

    await expect(repository.findByExperienceId('exp-1')).resolves.toEqual({
      experienceId: 'exp-1',
      object: 'hoodie',
      productSlug: 'mystery-hoodie',
      sizeCode: null,
      colorCode: null,
      colorLabel: null,
      colorSwatch: null,
      variantId: null,
      updatedAt: new Date('2026-08-18T06:10:00.000Z'),
    });
    expect(sql.query).toHaveBeenCalledWith(expect.stringContaining('FROM experience_physical_selection'), ['exp-1']);
  });

  test('persists size and advances OBJECT_SELECTED atomically', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]),
    };
    const repository = new PostgresPhysicalSelectionRepository(sql);
    const updatedAt = new Date('2026-08-18T06:15:00.000Z');

    await repository.confirmSizeAndAdvance({
      experienceId: 'exp-1',
      expectedStage: 'OBJECT_SELECTED',
      nextStage: 'SIZE_CONFIRMED',
      sizeCode: 'M',
      updatedAt,
    });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('UPDATE experiences');
    expect(String(statement)).toContain('UPDATE experience_physical_selection');
    expect(String(statement)).toContain('size_code');
    expect(params).toEqual([
      'exp-1',
      'OBJECT_SELECTED',
      'SIZE_CONFIRMED',
      'M',
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
