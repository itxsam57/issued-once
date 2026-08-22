import { expect, test, vi } from 'vitest';
import type { CheckoutQuoteRepository } from '@/server/checkout/CheckoutService';
import type { CheckoutStateRepository } from '@/server/checkout/CheckoutStartService';
import type { ContactRepository } from '@/server/contact/ContactRepository';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentGateway } from '@/server/payments/PaymentGateway';
import type { PaymentAttemptRecord, PaymentRepository } from '@/server/payments/PaymentRepository';
import type { ShippingRepository } from '@/server/shipping/ShippingRepository';

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
    findReusable: vi.fn(),
    create: vi.fn(),
    attachProvider: vi.fn(),
    findByProviderReference,
    recordProviderEvent,
    markPaid,
    markFailed: vi.fn(),
    markRefunded: vi.fn(),
  } as unknown as PaymentRepository;
  const verifyTracker = vi.fn(async () => verified);
  const gateway = {
    createCheckout: vi.fn(),
    verifyWebhook: vi.fn(),
    verifyTracker,
  } as unknown as PaymentGateway;
  const service = new PaymentService({
    experiences: { findBySessionHash: vi.fn() } as unknown as Pick<ExperienceRepository, 'findBySessionHash'>,
    quotes: {
      findById: vi.fn(),
      findLatestByExperienceId: vi.fn(),
    } as unknown as CheckoutQuoteRepository & { findLatestByExperienceId: ReturnType<typeof vi.fn> },
    contacts: {} as ContactRepository,
    shipping: {} as ShippingRepository,
    payments,
    gateway,
    checkoutStates: {} as CheckoutStateRepository,
    now: () => now,
  });
  return { service, findByProviderReference, verifyTracker, recordProviderEvent, markPaid };
}

test('return reconciliation marks paid only after Reporter proves the stored frozen quote', async () => {
  const { service, verifyTracker, recordProviderEvent, markPaid } = fixture(true);

  const result = await (service as PaymentService & {
    reconcileTracker(input: { providerReference: string }): Promise<{ kind: string; paymentAttemptId?: string }>;
  }).reconcileTracker({ providerReference: 'track_return_paid' });

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

  const result = await (service as PaymentService & {
    reconcileTracker(input: { providerReference: string }): Promise<{ kind: string; paymentAttemptId?: string }>;
  }).reconcileTracker({ providerReference: 'track_return_paid' });

  expect(result).toEqual({ kind: 'pending', paymentAttemptId: 'attempt-return-paid' });
  expect(recordProviderEvent).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});
