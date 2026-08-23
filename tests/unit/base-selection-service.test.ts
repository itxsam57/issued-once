import { describe, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { BaseSelectionService } from '@/server/physical/BaseSelectionService';

const token = 'browser-session-token';

function experience(stage = 'SIZE_CONFIRMED') {
  return {
    id: 'exp-1',
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: null,
    createdAt: new Date('2026-08-18T06:00:00.000Z'),
    updatedAt: new Date('2026-08-18T06:15:00.000Z'),
    expiresAt: new Date('2026-09-18T06:00:00.000Z'),
  } as const;
}

describe('BaseSelectionService', () => {
  test('locks one exact live provider variant and gives the customer one hour to finish contact and shipping', async () => {
    const physicalRepository = {
      findByExperienceId: vi.fn().mockResolvedValue({
        experienceId: 'exp-1',
        object: 'hoodie',
        productSlug: 'mystery-hoodie',
        sizeCode: 'M',
        updatedAt: new Date('2026-08-18T06:15:00.000Z'),
      }),
      confirmBaseAndAdvance: vi.fn().mockResolvedValue(undefined),
    };
    const quoteRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    };
    const catalog = {
      listVariants: vi.fn().mockResolvedValue([
        { id: 'v-m-black', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-m-bone', size: 'M', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
        { id: 'v-l-bone', size: 'L', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
      ]),
    };
    const service = new BaseSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience()) },
      physicalRepository,
      quoteRepository,
      catalog,
      currency: 'USD',
      now: () => new Date('2026-08-18T06:20:00.000Z'),
      createQuoteId: () => 'quote-opaque-001',
    });

    await expect(service.confirm({ sessionToken: token, colorCode: 'Bone' })).resolves.toEqual({
      quoteId: 'quote-opaque-001',
      amountMinor: 5400,
      currency: 'USD',
      expiresAt: '2026-08-18T07:20:00.000Z',
    });

    expect(catalog.listVariants).toHaveBeenCalledWith('mystery-hoodie', 'USD');
    expect(quoteRepository.create).toHaveBeenCalledWith({
      id: 'quote-opaque-001',
      experienceId: 'exp-1',
      productSlug: 'mystery-hoodie',
      variantId: 'v-m-bone',
      amountMinor: 5400,
      currency: 'USD',
      expiresAt: new Date('2026-08-18T07:20:00.000Z'),
    });
    expect(physicalRepository.confirmBaseAndAdvance).toHaveBeenCalledWith({
      experienceId: 'exp-1',
      expectedStage: 'SIZE_CONFIRMED',
      nextStage: 'COMMITMENT_READY',
      colorCode: 'Bone',
      colorLabel: 'Bone',
      colorSwatch: '#E8E0CF',
      variantId: 'v-m-bone',
      updatedAt: new Date('2026-08-18T06:20:00.000Z'),
    });
  });

  test('refuses an ambiguous live size and color instead of choosing an arbitrary provider variant', async () => {
    const physicalRepository = {
      findByExperienceId: vi.fn().mockResolvedValue({
        experienceId: 'exp-1',
        object: 'hoodie',
        productSlug: 'mystery-hoodie',
        sizeCode: 'M',
        updatedAt: new Date(),
      }),
      confirmBaseAndAdvance: vi.fn(),
    };
    const quoteRepository = { create: vi.fn() };
    const service = new BaseSelectionService({
      experienceRepository: { findBySessionHash: vi.fn().mockResolvedValue(experience()) },
      physicalRepository,
      quoteRepository,
      catalog: {
        listVariants: vi.fn().mockResolvedValue([
          { id: 'v-m-bone-a', size: 'M', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
          { id: 'v-m-bone-b', size: 'M', colorName: 'Bone', colorSwatch: '#E8E0CF', amountMinor: 5400, currency: 'USD', available: true },
        ]),
      },
      currency: 'USD',
    });

    await expect(service.confirm({ sessionToken: token, colorCode: 'Bone' })).rejects.toThrow(
      'Selected base is ambiguous',
    );
    expect(quoteRepository.create).not.toHaveBeenCalled();
    expect(physicalRepository.confirmBaseAndAdvance).not.toHaveBeenCalled();
  });
});
