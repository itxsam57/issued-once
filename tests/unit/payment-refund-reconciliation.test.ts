import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';
import type { PaymentAttemptRecord, PaymentRepository } from '@/server/payments/PaymentRepository';

const now = new Date('2026-09-01T10:00:00.000Z');

function fixture(refunded: boolean) {
  const attempt: PaymentAttemptRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    experienceId: 'exp-1',
    quoteId: 'quote-1',
    contactId: 'contact-1',
    shippingSnapshotId: 'shipping-1',
    provider: 'SAFEPAY',
    providerReference: 'track_refund_123',
    checkoutUrl: 'https://getsafepay.com/embedded?tracker=track_refund_123',
    amountMinor: 5400,
    currency: 'USD',
    status: 'PAID',
    createdAt: now,
    updatedAt: now,
  };

  const recordProviderEvent = vi.fn(async () => true);
  const markRefunded = vi.fn(async (input: { attemptId: string; amountMinor: number; currency: string; refundedAt: Date }) => {
    expect(input).toMatchObject({ attemptId: attempt.id, amountMinor: 5400, currency: 'USD' });
    attempt.status = 'REFUNDED';
    attempt.updatedAt = input.refundedAt;
    return 'refunded' as const;
  });
  const payments = {
    findByProviderReference: vi.fn(async (providerReference: string) => providerReference === attempt.providerReference ? attempt : null),
    recordProviderEvent,
    markRefunded,
  } as unknown as PaymentRepository;

  const verifyRefundedTracker = vi.fn(async () => refunded);
  const gateway = {
    verifyRefundedTracker,
  } as unknown as PaymentGateway;

  const service = new PaymentService({
    experiences: {} as never,
    quotes: {} as never,
    contacts: {} as never,
    shipping: {} as never,
    payments,
    gateway,
    checkoutStates: {} as never,
    now: () => now,
  });
  const reconcileRefund = (service as unknown as {
    reconcileRefund(input: { providerReference: string }): Promise<{ kind: string; paymentAttemptId?: string }>;
  }).reconcileRefund.bind(service);

  return { attempt, reconcileRefund, verifyRefundedTracker, recordProviderEvent, markRefunded };
}

test('keeps a paid attempt untouched when Safepay has not confirmed a full refund', async () => {
  const { attempt, reconcileRefund, verifyRefundedTracker, recordProviderEvent, markRefunded } = fixture(false);

  await expect(reconcileRefund({ providerReference: 'track_refund_123' })).resolves.toEqual({
    kind: 'pending', paymentAttemptId: attempt.id,
  });
  expect(verifyRefundedTracker).toHaveBeenCalledWith({
    providerReference: 'track_refund_123', amountMinor: 5400, currency: 'USD',
  });
  expect(attempt.status).toBe('PAID');
  expect(recordProviderEvent).not.toHaveBeenCalled();
  expect(markRefunded).not.toHaveBeenCalled();
});

test('records provider-derived full refund truth using only the stored attempt money', async () => {
  const { attempt, reconcileRefund, recordProviderEvent, markRefunded } = fixture(true);

  await expect(reconcileRefund({ providerReference: 'track_refund_123' })).resolves.toEqual({
    kind: 'refunded', paymentAttemptId: attempt.id,
  });
  expect(recordProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
    provider: 'SAFEPAY',
    providerEventId: 'reporter-refund:track_refund_123',
    providerReference: 'track_refund_123',
    state: 'REFUNDED',
    amountMinor: 5400,
    currency: 'USD',
  }));
  expect(markRefunded).toHaveBeenCalledTimes(1);
  expect(attempt.status).toBe('REFUNDED');
});
