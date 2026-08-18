import { describe, expect, test, vi } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { CheckoutStartService } from '@/server/checkout/CheckoutStartService';

const token = 'browser-session-token';
const experience = {
  id: 'exp-1',
  publicSessionHash: hashSessionToken(token),
  stage: 'PROFILE_COMPLETE' as const,
  hookId: 'public-entry',
  createdAt: new Date('2026-08-18T06:00:00.000Z'),
  updatedAt: new Date('2026-08-18T06:20:00.000Z'),
  expiresAt: new Date('2026-08-19T06:00:00.000Z'),
};

describe('CheckoutStartService', () => {
  test('binds an opaque quote to the current anonymous session before checkout', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(experience),
    };
    const checkout = {
      start: vi.fn().mockResolvedValue({ checkoutUrl: 'https://shop.example/checkout' }),
    };
    const service = new CheckoutStartService(experienceRepository, checkout);

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).resolves.toEqual({ checkoutUrl: 'https://shop.example/checkout' });

    expect(experienceRepository.findBySessionHash).toHaveBeenCalledWith(hashSessionToken(token));
    expect(checkout.start).toHaveBeenCalledWith({
      quoteId: 'quote-1',
      experienceId: 'exp-1',
    });
  });

  test('fails before commerce when the anonymous session is missing or expired', async () => {
    const experienceRepository = {
      findBySessionHash: vi.fn().mockResolvedValue(null),
    };
    const checkout = {
      start: vi.fn(),
    };
    const service = new CheckoutStartService(experienceRepository, checkout);

    await expect(
      service.start({ sessionToken: token, quoteId: 'quote-1' }),
    ).rejects.toThrow('Experience not found');
    expect(checkout.start).not.toHaveBeenCalled();
  });
});
