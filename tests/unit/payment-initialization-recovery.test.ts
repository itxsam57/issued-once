import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';
import type { PaymentAttemptRecord, PaymentProviderEvent, PaymentRepository } from '@/server/payments/PaymentRepository';

const sessionToken = 'retry-session';
const experience = {
  id: 'exp-1', publicSessionHash: hashSessionToken(sessionToken), stage: 'COMMITMENT_READY' as const, hookId: null,
  createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000),
};

class Repository implements PaymentRepository {
  attempt: PaymentAttemptRecord | null = null;
  async findReusable() { return this.attempt?.status === 'REDIRECTED' ? this.attempt : null; }
  async create(record: PaymentAttemptRecord) {
    if (this.attempt && ['CREATED','REDIRECTED','PAID'].includes(this.attempt.status)) return this.attempt;
    this.attempt = { ...record }; return this.attempt;
  }
  async attachProvider(input: { attemptId: string; providerReference: string; checkoutUrl: string; updatedAt: Date }) {
    if (!this.attempt || this.attempt.id !== input.attemptId) throw new Error('missing');
    Object.assign(this.attempt, { providerReference: input.providerReference, checkoutUrl: input.checkoutUrl, status: 'REDIRECTED', updatedAt: input.updatedAt });
  }
  async findByProviderReference() { return null; }
  async recordProviderEvent(_event: PaymentProviderEvent) { return true; }
  async markPaid() { return 'mismatch' as const; }
  async markRefunded() { return 'mismatch' as const; }
  async markFailed(attemptId: string, _event: string, at: Date) {
    if (this.attempt?.id === attemptId && ['CREATED','REDIRECTED'].includes(this.attempt.status)) {
      this.attempt.status = 'FAILED'; this.attempt.updatedAt = at;
    }
  }
}

function build(repository: Repository, createCheckout: PaymentGateway['createCheckout']) {
  return new PaymentService({
    experiences: { findBySessionHash: vi.fn(async () => experience) },
    quotes: { findById: vi.fn(async () => ({ id: 'quote-1', experienceId: 'exp-1', productSlug: 'tee', variantId: 't1', amountMinor: 5400, currency: 'USD', expiresAt: new Date(Date.now() + 3_600_000) })) },
    contacts: { findVerifiedByExperienceId: vi.fn(async () => ({ id: 'contact-1', experienceId: 'exp-1' })) } as never,
    shipping: { findByExperienceId: vi.fn(async () => ({ id: 'ship-1', experienceId: 'exp-1', contactId: 'contact-1' })) } as never,
    payments: repository,
    gateway: { createCheckout, verifyWebhook: vi.fn() },
    checkoutStates: { advance: vi.fn() },
  });
}

test('failed Safepay tracker initialization moves the unshown attempt out of the active set so a retry can create a new attempt', async () => {
  const repository = new Repository();
  const first = build(repository, vi.fn(async () => { throw new Error('network failed before checkout URL could be returned'); }));
  await expect(first.start({ sessionToken, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' })).rejects.toThrow(/network failed/i);
  expect(repository.attempt?.status).toBe('FAILED');

  const secondGateway: PaymentGateway['createCheckout'] = vi.fn(async ({ paymentAttemptId }) => ({
    providerReference: 'track-retry',
    checkoutUrl: `https://sandbox.api.getsafepay.com/checkout/pay?order_id=${paymentAttemptId}`,
  }));
  const second = build(repository, secondGateway);
  await expect(second.start({ sessionToken, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' })).resolves.toMatchObject({
    checkoutUrl: expect.stringContaining('order_id='),
  });
  expect(secondGateway).toHaveBeenCalledTimes(1);
  expect(repository.attempt?.status).toBe('REDIRECTED');
});
