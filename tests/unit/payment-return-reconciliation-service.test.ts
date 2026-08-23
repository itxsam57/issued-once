import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentAttemptRecord, PaymentRepository } from '@/server/payments/PaymentRepository';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';

const now = new Date('2026-08-22T18:15:00.000Z');
const attempt: PaymentAttemptRecord = {
  id: 'attempt-return-1',
  experienceId: 'experience-return-1',
  quoteId: 'quote-return-1',
  contactId: 'contact-return-1',
  shippingSnapshotId: 'shipping-return-1',
  provider: 'SAFEPAY',
  providerReference: 'track_return_1',
  checkoutUrl: 'https://getsafepay.com/embedded?tracker=track_return_1',
  amountMinor: 3200,
  currency: 'USD',
  status: 'REDIRECTED',
  createdAt: new Date('2026-08-22T18:00:00.000Z'),
  updatedAt: new Date('2026-08-22T18:00:00.000Z'),
};

function fixture(reporterVerified: boolean) {
  const payments = {
    findByProviderReference: vi.fn(async (reference: string) => reference === attempt.providerReference ? structuredClone(attempt) : null),
    recordProviderEvent: vi.fn(async () => true),
    markPaid: vi.fn(async () => 'paid' as const),
  } as unknown as PaymentRepository;
  const gateway = {
    verifyTracker: vi.fn(async () => reporterVerified),
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
  return { service, payments, gateway };
}

test('Reporter reconciliation marks the frozen redirected attempt paid without requiring a webhook', async () => {
  const { service, payments, gateway } = fixture(true);

  const result = await service.reconcileTracker({ providerReference: 'track_return_1' });

  expect(result).toEqual({ kind: 'paid', paymentAttemptId: 'attempt-return-1' });
  expect(gateway.verifyTracker).toHaveBeenCalledWith({
    providerReference: 'track_return_1',
    amountMinor: 3200,
    currency: 'USD',
  });
  expect(payments.recordProviderEvent).toHaveBeenCalledWith({
    provider: 'SAFEPAY',
    providerEventId: 'reporter:track_return_1',
    providerReference: 'track_return_1',
    state: 'PAID',
    amountMinor: 3200,
    currency: 'USD',
    reference: null,
    receivedAt: now,
  });
  expect(payments.markPaid).toHaveBeenCalledWith({
    attemptId: 'attempt-return-1',
    providerEventId: 'reporter:track_return_1',
    amountMinor: 3200,
    currency: 'USD',
    paidAt: now,
  });
});

test('Reporter reconciliation stays pending when Safepay cannot prove the frozen quote', async () => {
  const { service, payments } = fixture(false);

  await expect(service.reconcileTracker({ providerReference: 'track_return_1' }))
    .resolves.toEqual({ kind: 'pending', paymentAttemptId: 'attempt-return-1' });
  expect(payments.recordProviderEvent).not.toHaveBeenCalled();
  expect(payments.markPaid).not.toHaveBeenCalled();
});
