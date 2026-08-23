import { describe, expect, test, vi } from 'vitest';
import { PostgresPhysicalSelectionRepository } from '@/server/physical/PostgresPhysicalSelectionRepository';

describe('PostgresPhysicalSelectionRepository', () => {
  test('advances PROFILE_COMPLETE and persists the locked server product atomically', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]) };
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
    expect(params).toEqual(['exp-1', 'PROFILE_COMPLETE', 'OBJECT_SELECTED', 'hoodie', 'mystery-hoodie', updatedAt]);
  });

  test('reads the private locked physical record by experience id', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([{
        experience_id: 'exp-1', object_type: 'hoodie', product_slug: 'mystery-hoodie', size_code: null,
        color_code: null, color_label: null, color_swatch: null, variant_id: null,
        updated_at: new Date('2026-08-18T06:10:00.000Z'),
      }]),
    };
    const repository = new PostgresPhysicalSelectionRepository(sql);

    await expect(repository.findByExperienceId('exp-1')).resolves.toEqual({
      experienceId: 'exp-1', object: 'hoodie', productSlug: 'mystery-hoodie', sizeCode: null,
      colorCode: null, colorLabel: null, colorSwatch: null, variantId: null,
      updatedAt: new Date('2026-08-18T06:10:00.000Z'),
    });
    expect(sql.query).toHaveBeenCalledWith(expect.stringContaining('FROM experience_physical_selection'), ['exp-1']);
  });

  test('reads a persisted tote so the OS size gate can continue', async () => {
    const sql = {
      query: vi.fn().mockResolvedValue([{
        experience_id: 'exp-tote', object_type: 'tote', product_slug: 'io-tote', size_code: null,
        color_code: null, color_label: null, color_swatch: null, variant_id: null,
        updated_at: new Date('2026-08-23T11:18:18.357Z'),
      }]),
    };
    const repository = new PostgresPhysicalSelectionRepository(sql);

    await expect(repository.findByExperienceId('exp-tote')).resolves.toMatchObject({
      experienceId: 'exp-tote',
      object: 'tote',
      productSlug: 'io-tote',
      sizeCode: null,
    });
  });

  test('persists size and advances OBJECT_SELECTED atomically', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]) };
    const repository = new PostgresPhysicalSelectionRepository(sql);
    const updatedAt = new Date('2026-08-18T06:15:00.000Z');

    await repository.confirmSizeAndAdvance({
      experienceId: 'exp-1', expectedStage: 'OBJECT_SELECTED', nextStage: 'SIZE_CONFIRMED', sizeCode: 'M', updatedAt,
    });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('UPDATE experiences');
    expect(String(statement)).toContain('UPDATE experience_physical_selection');
    expect(String(statement)).toContain('size_code');
    expect(params).toEqual(['exp-1', 'OBJECT_SELECTED', 'SIZE_CONFIRMED', 'M', updatedAt]);
  });

  test('persists the exact base variant and advances SIZE_CONFIRMED to COMMITMENT_READY atomically', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ experience_id: 'exp-1' }]) };
    const repository = new PostgresPhysicalSelectionRepository(sql);
    const updatedAt = new Date('2026-08-18T06:20:00.000Z');

    await repository.confirmBaseAndAdvance({
      experienceId: 'exp-1',
      expectedStage: 'SIZE_CONFIRMED',
      nextStage: 'COMMITMENT_READY',
      colorCode: 'Bone',
      colorLabel: 'Bone',
      colorSwatch: '#E8E0CF',
      variantId: 'v-m-bone',
      updatedAt,
    });

    const [statement, params] = sql.query.mock.calls[0] ?? [];
    expect(String(statement)).toContain('UPDATE experiences');
    expect(String(statement)).toContain('UPDATE experience_physical_selection');
    expect(String(statement)).toContain('color_code');
    expect(String(statement)).toContain('color_label');
    expect(String(statement)).toContain('color_swatch');
    expect(String(statement)).toContain('variant_id');
    expect(String(statement)).toContain('size_code IS NOT NULL');
    expect(String(statement)).toContain('variant_id IS NULL');
    expect(params).toEqual([
      'exp-1', 'SIZE_CONFIRMED', 'COMMITMENT_READY', 'Bone', 'Bone', '#E8E0CF', 'v-m-bone', updatedAt,
    ]);
  });

  test('rejects a stale or repeated base transition', async () => {
    const repository = new PostgresPhysicalSelectionRepository({ query: vi.fn().mockResolvedValue([]) });

    await expect(repository.confirmBaseAndAdvance({
      experienceId: 'exp-1', expectedStage: 'SIZE_CONFIRMED', nextStage: 'COMMITMENT_READY',
      colorCode: 'Bone', colorLabel: 'Bone', colorSwatch: '#E8E0CF', variantId: 'v-m-bone', updatedAt: new Date(),
    })).rejects.toThrow('Physical selection stage conflict');
  });
});
