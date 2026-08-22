import { describe, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { SizeSelectionService } from '@/server/physical/SizeSelectionService';

const token = 'browser-session-token';

function experience(stage = 'OBJECT_SELECTED') {
  return {
    id: 'exp-1',
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: null,
    createdAt: new Date('2026-08-18T06:00:00.000Z'),
    updatedAt: new Date('2026-08-18T06:10:00.000Z'),
    expiresAt: new Date('2026-09-18T06:00:00.000Z'),
  } as const;
}

describe('SizeSelectionService', () => {
  test('confirms only an available size for the stored server product and returns unique available colors', async () => {
    const physicalRepository = {
      findByExperienceId: vi.fn().mockResolvedValue({
        experienceId: 'exp-1',
        object: 'hoodie',
        productSlug: 'mystery-hoodie',
        updatedAt: new Date('2026-08-18T06:10:00.000Z'),
      }),
      confirmSizeAndAdvance: vi.fn().mockResolvedValue(undefined),
    };
    const catalog = {
      listVariants: vi.fn().mockResolvedValue([
        { id: 'v-m-black', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-m-bone', size: 'M', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-m-black-2', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-m-ash', size: 'M', colorName: 'Ash', colorSwatch: '#AAAAAA', amountMinor: 5400, currency: 'USD', available: false },
        { id: 'v-l-black', size: 'L', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
      ]),
    };
    const service = new SizeSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience()) },
      physicalRepository,
      catalog,
      currency: 'USD',
      now: () => new Date('2026-08-18T06:15:00.000Z'),
    });

    await expect(service.confirm({ sessionToken: token, sizeCode: 'M' })).resolves.toEqual({
      colors: [
        { code: 'Black', label: 'Black', swatch: '#000000' },
        { code: 'Bone', label: 'Bone', swatch: '#E8E0CF' },
      ],
    });

    expect(catalog.listVariants).toHaveBeenCalledWith('mystery-hoodie', 'USD');
    expect(physicalRepository.confirmSizeAndAdvance).toHaveBeenCalledWith({
      experienceId: 'exp-1',
      expectedStage: 'OBJECT_SELECTED',
      nextStage: 'SIZE_CONFIRMED',
      sizeCode: 'M',
      updatedAt: new Date('2026-08-18T06:15:00.000Z'),
    });
  });

  test('refuses a size that is not currently available from the stored product', async () => {
    const physicalRepository = {
      findByExperienceId: vi.fn().mockResolvedValue({
        experienceId: 'exp-1',
        object: 'hoodie',
        productSlug: 'mystery-hoodie',
        updatedAt: new Date(),
      }),
      confirmSizeAndAdvance: vi.fn(),
    };
    const service = new SizeSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience()) },
      physicalRepository,
      catalog: {
        listVariants: vi.fn().mockResolvedValue([
          { id: 'v-l-black', size: 'L', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        ]),
      },
      currency: 'USD',
    });

    await expect(service.confirm({ sessionToken: token, sizeCode: 'M' })).rejects.toThrow(
      'Selected size is unavailable',
    );
    expect(physicalRepository.confirmSizeAndAdvance).not.toHaveBeenCalled();
  });
});
