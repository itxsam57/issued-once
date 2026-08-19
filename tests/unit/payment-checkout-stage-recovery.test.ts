import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import { hashSessionToken } from '@/server/http/sessionToken';

const sessionToken = 'stage-recovery';
const now = new Date('2026-08-19T06:00:00Z');

test('reused redirected payment repairs COMMITMENT_READY to CHECKOUT_STARTED before returning the URL', async () => {
  const advance = vi.fn(async () => undefined);
  const service = new PaymentService({
    experiences: { findBySessionHash: vi.fn(async (hash: string) => hash === hashSessionToken(sessionToken) ? ({
      id: 'exp-1', publicSessionHash: hash, stage: 'COMMITMENT_READY' as const, hookId: null,
      createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 3_600_000),
    }) : null) },
    quotes: { findById: vi.fn(async () => ({
      id: 'quote-1', experienceId: 'exp-1', productSlug: 'tee', variantId: 'tee-m-black',
      amountMinor: 5400, currency: 'USD', expiresAt: new Date(now.getTime() + 600_000),
    })) },
    contacts: { findVerifiedByExperienceId: vi.fn(async () => ({ id: 'contact-1', experienceId: 'exp-1' })) } as never,
    shipping: { findByExperienceId: vi.fn(async () => ({ id: 'ship-1', experienceId: 'exp-1', contactId: 'contact-1' })) } as never,
    payments: {
      findReusable: vi.fn(async () => ({
        id: 'pay-1', experienceId: 'exp-1', quoteId: 'quote-1', contactId: 'contact-1', shippingSnapshotId: 'ship-1',
        provider: 'SAFEPAY' as const, providerReference: 'track-1', checkoutUrl: 'https://sandbox.api.getsafepay.com/checkout/pay?beacon=track-1',
        amountMinor: 5400, currency: 'USD', status: 'REDIRECTED' as const, createdAt: now, updatedAt: now,
      })),
      create: vi.fn(), attachProvider: vi.fn(), findByProviderReference: vi.fn(), recordProviderEvent: vi.fn(),
      markPaid: vi.fn(), markFailed: vi.fn(), markRefunded: vi.fn(),
    },
    gateway: { createCheckout: vi.fn(), verifyWebhook: vi.fn() },
    checkoutStates: { advance },
    now: () => now,
  });

  await expect(service.start({ sessionToken, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' }))
    .resolves.toEqual({
      checkoutUrl: 'https://sandbox.api.getsafepay.com/checkout/pay?beacon=track-1',
      paymentAttemptId: 'pay-1',
    });
  expect(advance).toHaveBeenCalledWith({
    experienceId: 'exp-1', expectedStage: 'COMMITMENT_READY', nextStage: 'CHECKOUT_STARTED', updatedAt: now,
  });
});

test('if stage repair fails, the hosted URL is not returned to the browser', async () => {
  const service = new PaymentService({
    experiences: { findBySessionHash: vi.fn(async (hash: string) => ({
      id: 'exp-1', publicSessionHash: hash, stage: 'COMMITMENT_READY' as const, hookId: null,
      createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 3_600_000),
    })) },
    quotes: { findById: vi.fn(async () => ({ id: 'quote-1', experienceId: 'exp-1', productSlug: 'tee', variantId: 'v1', amountMinor: 5400, currency: 'USD', expiresAt: new Date(now.getTime() + 600_000) })) },
    contacts: { findVerifiedByExperienceId: vi.fn(async () => ({ id: 'contact-1', experienceId: 'exp-1' })) } as never,
    shipping: { findByExperienceId: vi.fn(async () => ({ id: 'ship-1', experienceId: 'exp-1', contactId: 'contact-1' })) } as never,
    payments: {
      findReusable: vi.fn(async () => ({ id: 'pay-1', experienceId: 'exp-1', quoteId: 'quote-1', contactId: 'contact-1', shippingSnapshotId: 'ship-1', provider: 'SAFEPAY' as const, providerReference: 'track-1', checkoutUrl: 'https://sandbox.api.getsafepay.com/checkout/pay?beacon=track-1', amountMinor: 5400, currency: 'USD', status: 'REDIRECTED' as const, createdAt: now, updatedAt: now })),
      create: vi.fn(), attachProvider: vi.fn(), findByProviderReference: vi.fn(), recordProviderEvent: vi.fn(), markPaid: vi.fn(), markFailed: vi.fn(), markRefunded: vi.fn(),
    },
    gateway: { createCheckout: vi.fn(), verifyWebhook: vi.fn() },
    checkoutStates: { advance: vi.fn(async () => { throw new Error('state transition unavailable'); }) },
    now: () => now,
  });

  await expect(service.start({ sessionToken, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' }))
    .rejects.toThrow(/state transition unavailable/i);
});
