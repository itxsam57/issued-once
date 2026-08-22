import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentAttemptRecord, PaymentProviderEvent, PaymentRepository } from '@/server/payments/PaymentRepository';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';

const attempt: PaymentAttemptRecord = {
  id: 'pay-1', experienceId: 'exp-1', quoteId: 'quote-1', contactId: 'contact-1', shippingSnapshotId: 'ship-1',
  provider: 'SAFEPAY', providerReference: 'track-1', checkoutUrl: 'https://getsafepay.com/checkout/pay',
  amountMinor: 5400, currency: 'USD', status: 'PAID', createdAt: new Date(), updatedAt: new Date(),
};

class RefundRepository implements PaymentRepository {
  status = attempt.status;
  events = new Set<string>();
  async findReusable() { return null; }
  async create(record: PaymentAttemptRecord) { return record; }
  async attachProvider() {}
  async findByProviderReference(reference: string) { return reference === 'track-1' ? { ...attempt, status: this.status } : null; }
  async recordProviderEvent(event: PaymentProviderEvent) {
    if (this.events.has(event.providerEventId)) return false;
    this.events.add(event.providerEventId); return true;
  }
  async markPaid() { return 'duplicate' as const; }
  async markFailed() {}
  async markRefunded(input: { attemptId: string; amountMinor: number; currency: string; refundedAt: Date }) {
    if (input.amountMinor !== 5400 || input.currency !== 'USD') {
      this.status = 'EXCEPTION'; return 'mismatch' as const;
    }
    if (this.status === 'REFUNDED') return 'duplicate' as const;
    this.status = 'REFUNDED'; return 'refunded' as const;
  }
}

test('signed full refund returns the payment identity and changes paid truth to REFUNDED', async () => {
  const repository = new RefundRepository();
  const gateway: PaymentGateway = {
    createCheckout: vi.fn(),
    verifyTracker: vi.fn(async () => true),
    verifyWebhook: vi.fn(() => ({
      providerEventId: 'refund-1', providerReference: 'track-1', state: 'REFUNDED' as const,
      amountMinor: 5400, currency: 'USD', reference: 'refund-ref', occurredAt: new Date('2026-08-19T05:00:00Z'),
    })),
  };
  const service = new PaymentService({
    experiences: { findBySessionHash: vi.fn() },
    quotes: { findById: vi.fn(), findLatestByExperienceId: vi.fn() },
    contacts: { findVerifiedByExperienceId: vi.fn() } as never,
    shipping: { findByExperienceId: vi.fn() } as never,
    payments: repository,
    gateway,
    checkoutStates: { advance: vi.fn() },
  });

  await expect(service.handleWebhook({ rawBody: '{}', headers: new Headers() })).resolves.toEqual({
    kind: 'refunded', paymentAttemptId: 'pay-1',
  });
  expect(repository.status).toBe('REFUNDED');
});
