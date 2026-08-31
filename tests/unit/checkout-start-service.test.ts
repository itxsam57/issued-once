import { describe, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { CheckoutStartService } from '@/server/checkout/CheckoutStartService';

const token = 'browser-session-token';

function experience(stage: 'COMMITMENT_READY' | 'PROFILE_COMPLETE' = 'COMMITMENT_READY') {
  return {
    id: 'exp-1',
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: 'public-entry',
    createdAt: new Date('2026-08-18T06:00:00.000Z'),
    updatedAt: new Date('2026-08-18T06:20:00.000Z'),
    expiresAt: new Date('2026-08-19T06:00:00.000Z'),
  } as const;
}

describe('CheckoutStartService', () => {
  test('requires COMMITMENT_READY, creates checkout, then advances to CHECKOUT_STARTED before returning the URL', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience()),
    };
    const checkout = {
      start: vi.fn().mockResolvedValue({ checkoutUrl: 'https://shop.example/checkout' }),
    };
    const stateRepository = {
      advance: vi.fn().mockResolvedValue(undefined),
    };
    const now = new Date('2026-08-18T06:25:00.000Z');
    const service = new CheckoutStartService(
      experienceRepository,
      checkout,
      stateRepository,
      () => now,
    );

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).resolves.toEqual({ checkoutUrl: 'https://shop.example/checkout' });

    expect(experienceRepository.findBySessionHash).toHaveBeenCalledWith(hashSessionToken(token));
    expect(checkout.start).toHaveBeenCalledWith({
      quoteId: 'quote-1',
      experienceId: 'exp-1',
    });
    expect(stateRepository.advance).toHaveBeenCalledWith({
      experienceId: 'exp-1',
      expectedStage: 'COMMITMENT_READY',
      nextStage: 'CHECKOUT_STARTED',
      updatedAt: now,
    });
    expect(checkout.start.mock.invocationCallOrder[0]).toBeLessThan(
      stateRepository.advance.mock.invocationCallOrder[0],
    );
  });

  test('fails before commerce when the anonymous session is missing or expired', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(null),
    };
    const checkout = { start: vi.fn() };
    const stateRepository = { advance: vi.fn() };
    const service = new CheckoutStartService(experienceRepository, checkout, stateRepository);

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).rejects.toThrow('Experience not found');
    expect(checkout.start).not.toHaveBeenCalled();
    expect(stateRepository.advance).not.toHaveBeenCalled();
  });

  test('refuses checkout from any stage other than COMMITMENT_READY', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience('PROFILE_COMPLETE')),
    };
    const checkout = { start: vi.fn() };
    const stateRepository = { advance: vi.fn() };
    const service = new CheckoutStartService(experienceRepository, checkout, stateRepository);

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).rejects.toThrow('Checkout is not unlocked');
    expect(checkout.start).not.toHaveBeenCalled();
    expect(stateRepository.advance).not.toHaveBeenCalled();
  });

  test('does not advance checkout state when hosted cart creation fails', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience()),
    };
    const checkout = {
      start: vi.fn().mockRejectedValue(new Error('Variant unavailable')),
    };
    const stateRepository = { advance: vi.fn() };
    const service = new CheckoutStartService(experienceRepository, checkout, stateRepository);

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).rejects.toThrow('Variant unavailable');
    expect(stateRepository.advance).not.toHaveBeenCalled();
  });

  test('fails closed before commerce when owner-published catalog authority is absent', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience()),
    };
    const checkout = {
      start: vi.fn().mockResolvedValue({ checkoutUrl: 'https://shop.example/checkout' }),
    };
    const stateRepository = { advance: vi.fn() };
    const catalogAuthority = {
      assertOwnerPublished: vi.fn().mockRejectedValue(new Error('Owner-published active catalog is required')),
    };
    const service = new CheckoutStartService(
      experienceRepository,
      checkout,
      stateRepository,
      undefined,
      catalogAuthority,
    );

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-boot' }),
    ).rejects.toThrow(/owner-published active catalog/i);
    expect(catalogAuthority.assertOwnerPublished).toHaveBeenCalledTimes(1);
    expect(checkout.start).not.toHaveBeenCalled();
    expect(stateRepository.advance).not.toHaveBeenCalled();
  });
});
