import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentAttemptRecord } from '@/server/payments/PaymentRepository';

const now = new Date('2026-09-01T09:40:00.000Z');
const attempt: PaymentAttemptRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  experienceId: '22222222-2222-4222-8222-222222222222',
  quoteId: '33333333-3333-4333-8333-333333333333',
  contactId: '44444444-4444-4444-8444-444444444444',
  shippingSnapshotId: '55555555-5555-4555-8555-555555555555',
  provider: 'SAFEPAY',
  providerReference: 'track_paid_1',
  checkoutUrl: 'https://getsafepay.com/embedded?tracker=track_paid_1',
  amountMinor: 3200,
  currency: 'USD',
  status: 'PAID',
  createdAt: now,
  updatedAt: now,
};

function service(providerRefunded: boolean) {
  const verifyRefundedTracker = vi.fn().mockResolvedValue(providerRefunded);
  const recordProviderEvent = vi.fn().mockResolvedValue(true);
  const markRefunded = vi.fn().mockResolvedValue('refunded');
  const dependencies = {
    experiences: {}, quotes: {}, contacts: {}, shipping: {}, checkoutStates: {},
    payments: {
      findByProviderReference: vi.fn().mockResolvedValue(attempt),
      recordProviderEvent,
      markRefunded,
    },
    gateway: { verifyRefundedTracker },
    now: () => now,
  };
  return {
    paymentService: new PaymentService(dependencies as never),
    verifyRefundedTracker,
    recordProviderEvent,
    markRefunded,
  };
}

test('reconciles a full provider-confirmed refund using only stored payment money truth', async () => {
  const fixture = service(true);

  await expect(fixture.paymentService.reconcileRefund({ providerReference: 'track_paid_1' }))
    .resolves.toEqual({ kind: 'refunded', paymentAttemptId: attempt.id });

  expect(fixture.verifyRefundedTracker).toHaveBeenCalledWith({
    providerReference: 'track_paid_1', amountMinor: 3200, currency: 'USD',
  });
  expect(fixture.recordProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
    state: 'REFUNDED', amountMinor: 3200, currency: 'USD',
  }));
  expect(fixture.markRefunded).toHaveBeenCalledWith({
    attemptId: attempt.id, amountMinor: 3200, currency: 'USD', refundedAt: now,
  });
});

test('provider-not-refunded leaves a paid attempt unchanged', async () => {
  const fixture = service(false);

  await expect(fixture.paymentService.reconcileRefund({ providerReference: 'track_paid_1' }))
    .resolves.toEqual({ kind: 'pending', paymentAttemptId: attempt.id });

  expect(fixture.recordProviderEvent).not.toHaveBeenCalled();
  expect(fixture.markRefunded).not.toHaveBeenCalled();
});
