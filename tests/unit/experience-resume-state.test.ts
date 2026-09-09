import { describe, expect, it, vi } from 'vitest';
import type { ExperienceRecord } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import { ExperienceResumeService } from '@/server/experience/ExperienceResumeService';

const token = 'returning-token';
const baseExperience: ExperienceRecord = {
  id: 'exp-1', publicSessionHash: hashSessionToken(token), stage: 'PROFILE_COMPLETE',
  hookId: 'public-entry', createdAt: new Date('2026-09-09T00:00:00Z'),
  updatedAt: new Date('2026-09-09T00:10:00Z'), expiresAt: new Date('2026-10-09T00:00:00Z'),
};

function service(stage: ExperienceRecord['stage'], options?: {
  verified?: boolean;
  shipping?: boolean;
  quoteExpired?: boolean;
  quoteAmountMinor?: number;
}) {
  const experience = { ...baseExperience, stage };
  const quoteCreate = vi.fn(async () => undefined);
  const variants = [
    { id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5600, currency: 'USD', available: true },
    { id: 'tee-l-black', size: 'L', colorName: 'Black', colorSwatch: '#000000', amountMinor: 5800, currency: 'USD', available: true },
    { id: 'tee-m-navy', size: 'M', colorName: 'Navy', colorSwatch: '#111827', amountMinor: 5600, currency: 'USD', available: true },
  ];
  const physical = stage === 'PROFILE_COMPLETE' ? null : {
    experienceId: 'exp-1', object: 'tee' as const, productSlug: 'io-tee',
    sizeCode: ['SIZE_CONFIRMED', 'COMMITMENT_READY'].includes(stage) ? 'M' : null,
    colorCode: stage === 'COMMITMENT_READY' ? 'Black' : null,
    colorLabel: stage === 'COMMITMENT_READY' ? 'Black' : null,
    colorSwatch: stage === 'COMMITMENT_READY' ? '#000000' : null,
    variantId: stage === 'COMMITMENT_READY' ? 'tee-m-black' : null,
    updatedAt: new Date('2026-09-09T00:10:00Z'),
  };
  return {
    quoteCreate,
    instance: new ExperienceResumeService({
      experiences: { findBySessionHash: async (hash: string) => hash === experience.publicSessionHash ? experience : null },
      physical: { findByExperienceId: async () => physical },
      quotes: {
        findLatestByExperienceId: async () => stage === 'COMMITMENT_READY' ? {
          id: 'quote-old', experienceId: 'exp-1', productSlug: 'io-tee', variantId: 'tee-m-black',
          amountMinor: options?.quoteAmountMinor ?? 5600, currency: 'USD',
          expiresAt: new Date(options?.quoteExpired ? '2026-09-09T00:30:00Z' : '2026-09-09T02:30:00Z'),
        } : null,
        create: quoteCreate,
      },
      contacts: { findVerifiedByExperienceId: async () => options?.verified ? ({ id: 'contact-1' } as never) : null },
      shipping: { findByExperienceId: async () => options?.shipping ? ({ id: 'ship-1' } as never) : null },
      catalog: { listVariants: async () => variants },
      currency: 'USD',
      now: () => new Date('2026-09-09T01:00:00Z'),
      createQuoteId: () => 'quote-fresh',
    }),
  };
}

describe('ExperienceResumeService', () => {
  it('resumes PROFILE_COMPLETE at object selection', async () => {
    expect(await service('PROFILE_COMPLETE').instance.read(token)).toMatchObject({ phase: 'form' });
  });

  it('hydrates saved object and available sizes at OBJECT_SELECTED', async () => {
    const result = await service('OBJECT_SELECTED').instance.read(token);
    expect(result).toMatchObject({ phase: 'size', object: 'tee' });
    expect(result.sizes).toEqual([{ code: 'M', label: 'M' }, { code: 'L', label: 'L' }]);
  });

  it('hydrates saved size and available colors at SIZE_CONFIRMED', async () => {
    const result = await service('SIZE_CONFIRMED').instance.read(token);
    expect(result).toMatchObject({ phase: 'base', object: 'tee', sizeCode: 'M' });
    expect(result.colors).toEqual([
      { code: 'Black', label: 'Black', swatch: '#000000' },
      { code: 'Navy', label: 'Navy', swatch: '#111827' },
    ]);
  });

  it.each([
    [false, false, 'contact'],
    [true, false, 'shipping'],
    [true, true, 'commitment'],
  ] as const)('resumes COMMITMENT_READY with verified=%s shipping=%s at %s', async (verified, shipping, phase) => {
    const result = await service('COMMITMENT_READY', { verified, shipping }).instance.read(token);
    expect(result).toMatchObject({
      phase, object: 'tee', sizeCode: 'M', color: { code: 'Black', label: 'Black' },
      quote: { quoteId: 'quote-old', amountMinor: 5600, currency: 'USD' },
    });
  });

  it('preserves an unexpired server-issued discounted quote instead of silently removing the referral', async () => {
    const harness = service('COMMITMENT_READY', {
      verified: true,
      shipping: true,
      quoteAmountMinor: 5040,
    });
    const result = await harness.instance.read(token);
    expect(result.quote).toMatchObject({ quoteId: 'quote-old', amountMinor: 5040, currency: 'USD' });
    expect(harness.quoteCreate).not.toHaveBeenCalled();
  });

  it('refreshes an expired quote from the current saved variant before commitment resumes', async () => {
    const harness = service('COMMITMENT_READY', { verified: true, shipping: true, quoteExpired: true });
    const result = await harness.instance.read(token);
    expect(result.quote).toMatchObject({ quoteId: 'quote-fresh', amountMinor: 5600, currency: 'USD' });
    expect(harness.quoteCreate).toHaveBeenCalledTimes(1);
  });
});
