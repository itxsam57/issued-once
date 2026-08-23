import { expect, test, vi } from 'vitest';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';
import type { PaymentAttemptRecord, PaymentRepository } from '@/server/payments/PaymentRepository';

const now = new Date('2026-08-22T18:30:00.000Z');
const attempt: PaymentAttemptRecord = {
  id: 'attempt-return-paid',
  experienceId: 'experience-return-paid',
  quoteId: 'quote-return-paid',
  contactId: 'contact-return-paid',
  shippingSnapshotId: 'shipping-return-paid',
  provider: 'SAFEPAY',
  providerReference: 'track_return_paid',
  checkoutUrl: 'https://getsafepay.com/embedded?tracker=track_return_paid',
  amountMinor: 3200,
  currency: 'USD',
  status: 'REDIRECTED',
  createdAt: now,
  updatedAt: now,
};

function fixture(verified = true) {
  const findByProviderReference = vi.fn(async (reference: string) =>
    reference === attempt.providerReference ? structuredClone(attempt) : null,
  );
  const recordProviderEvent = vi.fn(async () => true);
  const markPaid = vi.fn(async () => 'paid' as const);
  const payments = {
    findByProviderReference,
    recordProviderEvent,
    markPaid,
  } as unknown as PaymentRepository;
  const verifyTracker = vi.fn(async () => verified);
  const gateway = { verifyTracker } as unknown as PaymentGateway;
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
  return { service, verifyTracker, recordProviderEvent, markPaid };
}

test('return reconciliation marks paid only after Reporter proves the stored frozen quote', async () => {
  const { service, verifyTracker, recordProviderEvent, markPaid } = fixture(true);

  const result = await service.reconcileTracker({ providerReference: 'track_return_paid' });

  expect(result).toEqual({ kind: 'paid', paymentAttemptId: 'attempt-return-paid' });
  expect(verifyTracker).toHaveBeenCalledWith({
    providerReference: 'track_return_paid',
    amountMinor: 3200,
    currency: 'USD',
  });
  expect(recordProviderEvent).toHaveBeenCalledWith({
    provider: 'SAFEPAY',
    providerEventId: 'reporter:track_return_paid',
    providerReference: 'track_return_paid',
    state: 'PAID',
    amountMinor: 3200,
    currency: 'USD',
    reference: null,
    receivedAt: now,
  });
  expect(markPaid).toHaveBeenCalledWith({
    attemptId: 'attempt-return-paid',
    providerEventId: 'reporter:track_return_paid',
    amountMinor: 3200,
    currency: 'USD',
    paidAt: now,
  });
});

test('return reconciliation stays pending when Reporter cannot prove completion', async () => {
  const { service, recordProviderEvent, markPaid } = fixture(false);

  const result = await service.reconcileTracker({ providerReference: 'track_return_paid' });

  expect(result).toEqual({ kind: 'pending', paymentAttemptId: 'attempt-return-paid' });
  expect(recordProviderEvent).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});
