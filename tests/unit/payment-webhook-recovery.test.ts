import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentAttemptRecord, PaymentProviderEvent, PaymentRepository } from '@/server/payments/PaymentRepository';
import type { PaymentGateway, VerifiedPaymentEvent } from '@/server/payments/PaymentGateway';

class RecoveryRepository implements PaymentRepository {
  attempt: PaymentAttemptRecord;
  eventAlreadyRecorded = true;
  constructor(status: PaymentAttemptRecord['status']) {
    this.attempt = {
      id: 'pay-1', experienceId: 'exp-1', quoteId: 'quote-1', contactId: 'contact-1', shippingSnapshotId: 'ship-1',
      provider: 'SAFEPAY', providerReference: 'track-1', checkoutUrl: 'https://getsafepay.com/checkout/pay',
      amountMinor: 5400, currency: 'USD', status, createdAt: new Date(), updatedAt: new Date(),
    };
  }
  async findReusable() { return null; }
  async create(record: PaymentAttemptRecord) { return record; }
  async attachProvider() {}
  async findByProviderReference(reference: string) { return reference === 'track-1' ? this.attempt : null; }
  async recordProviderEvent(_event: PaymentProviderEvent) { return !this.eventAlreadyRecorded; }
  async markPaid(input: { amountMinor: number; currency: string; paidAt: Date }) {
    if (this.attempt.status === 'PAID') return 'duplicate' as const;
    if (this.attempt.status !== 'REDIRECTED' || input.amountMinor !== 5400 || input.currency !== 'USD') return 'mismatch' as const;
    this.attempt.status = 'PAID'; this.attempt.updatedAt = input.paidAt; return 'paid' as const;
  }
  async markFailed() { this.attempt.status = 'FAILED'; }
  async markRefunded(input: { amountMinor: number; currency: string; refundedAt: Date }) {
    if (this.attempt.status === 'REFUNDED') return 'duplicate' as const;
    if (this.attempt.status !== 'PAID' || input.amountMinor !== 5400 || input.currency !== 'USD') return 'mismatch' as const;
    this.attempt.status = 'REFUNDED'; this.attempt.updatedAt = input.refundedAt; return 'refunded' as const;
  }
}

function service(repository: RecoveryRepository, event: VerifiedPaymentEvent) {
  const gateway: PaymentGateway = { createCheckout: vi.fn(), verifyWebhook: vi.fn(() => event) };
  return new PaymentService({
    experiences: { findBySessionHash: vi.fn() },
    quotes: { findById: vi.fn() },
    contacts: { findVerifiedByExperienceId: vi.fn() } as never,
    shipping: { findByExperienceId: vi.fn() } as never,
    payments: repository,
    gateway,
    checkoutStates: { advance: vi.fn() },
  });
}

test('replayed PAID event still completes payment state when provider event was recorded before a crash', async () => {
  const repository = new RecoveryRepository('REDIRECTED');
  const result = await service(repository, {
    providerEventId: 'evt-paid', providerReference: 'track-1', state: 'PAID', amountMinor: 5400,
    currency: 'USD', reference: 'r1', occurredAt: new Date('2026-08-19T05:00:00Z'),
  }).handleWebhook({ rawBody: '{}', headers: new Headers() });
  expect(result).toEqual({ kind: 'paid', paymentAttemptId: 'pay-1' });
  expect(repository.attempt.status).toBe('PAID');
});

test('replayed REFUNDED event still completes refund state and remains a refund on later retries', async () => {
  const repository = new RecoveryRepository('PAID');
  const payment = service(repository, {
    providerEventId: 'evt-refund', providerReference: 'track-1', state: 'REFUNDED', amountMinor: 5400,
    currency: 'USD', reference: 'r2', occurredAt: new Date('2026-08-19T05:05:00Z'),
  });
  expect(await payment.handleWebhook({ rawBody: '{}', headers: new Headers() })).toEqual({ kind: 'refunded', paymentAttemptId: 'pay-1' });
  expect(repository.attempt.status).toBe('REFUNDED');
  expect(await payment.handleWebhook({ rawBody: '{}', headers: new Headers() })).toEqual({ kind: 'refunded', paymentAttemptId: 'pay-1' });
});
