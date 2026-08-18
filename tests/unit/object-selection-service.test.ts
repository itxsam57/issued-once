import { describe, expect, test, vi } from 'vitest';
import { ObjectSelectionService } from '@/server/physical/ObjectSelectionService';
import { hashSessionToken } from '@/server/http/sessionToken';

const token = 'browser-session-token';

function experience(stage = 'PROFILE_COMPLETE') {
  return {
    id: 'exp-1',
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: null,
    createdAt: new Date('2026-08-18T06:00:00.000Z'),
    updatedAt: new Date('2026-08-18T06:05:00.000Z'),
    expiresAt: new Date('2026-09-18T06:00:00.000Z'),
  } as const;
}

describe('ObjectSelectionService', () => {
  test('locks a server-configured product and returns unique in-stock provider sizes', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience()),
    };
    const physicalRepository = {
      selectObjectAndAdvance: vi.fn().mockResolvedValue(undefined),
    };
    const catalog = {
      listVariants: vi.fn().mockResolvedValue([
        { id: 'v-m-black', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-m-bone', size: 'M', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-l-black', size: 'L', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-xl-black', size: 'XL', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: false },
      ]),
    };
    const service = new ObjectSelectionService({
      experienceRepository,
      physicalRepository,
      catalog,
      productSlugs: {
        tee: 'mystery-tee',
        hoodie: 'mystery-hoodie',
        hat: 'mystery-hat',
      },
      currency: 'USD',
      now: () => new Date('2026-08-18T06:10:00.000Z'),
    });

    await expect(service.select({ sessionToken: token, object: 'hoodie' })).resolves.toEqual({
      sizes: [
        { code: 'M', label: 'M' },
        { code: 'L', label: 'L' },
      ],
    });

    expect(experienceRepository.findBySessionHash).toHaveBeenCalledWith(hashSessionToken(token));
    expect(catalog.listVariants).toHaveBeenCalledWith('mystery-hoodie', 'USD');
    expect(physicalRepository.selectObjectAndAdvance).toHaveBeenCalledWith({
      experienceId: 'exp-1',
      expectedStage: 'PROFILE_COMPLETE',
      nextStage: 'OBJECT_SELECTED',
      object: 'hoodie',
      productSlug: 'mystery-hoodie',
      updatedAt: new Date('2026-08-18T06:10:00.000Z'),
    });
  });

  test('refuses object selection before the profile is complete', async () => {
    const catalog = { listVariants: vi.fn() };
    const physicalRepository = { selectObjectAndAdvance: vi.fn() };
    const service = new ObjectSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience('QUESTION_6')) },
      physicalRepository,
      catalog,
      productSlugs: { tee: 'mystery-tee', hoodie: 'mystery-hoodie', hat: 'mystery-hat' },
      currency: 'USD',
    });

    await expect(service.select({ sessionToken: token, object: 'hoodie' })).rejects.toThrow(
      'Physical form is not unlocked',
    );
    expect(catalog.listVariants).not.toHaveBeenCalled();
    expect(physicalRepository.selectObjectAndAdvance).not.toHaveBeenCalled();
  });

  test('refuses to lock a product with no currently available sizes', async () => {
    const physicalRepository = { selectObjectAndAdvance: vi.fn() };
    const service = new ObjectSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience()) },
      physicalRepository,
      catalog: {
        listVariants: vi.fn().mockResolvedValue([
          { id: 'v-s', size: 'S', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: false },
        ]),
      },
      productSlugs: { tee: 'mystery-tee', hoodie: 'mystery-hoodie', hat: 'mystery-hat' },
      currency: 'USD',
    });

    await expect(service.select({ sessionToken: token, object: 'hoodie' })).rejects.toThrow(
      'No available sizes',
    );
    expect(physicalRepository.selectObjectAndAdvance).not.toHaveBeenCalled();
  });
});
