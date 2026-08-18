import { expect, test, vi } from 'vitest';
import type { CheckoutQuoteRepository } from '@/server/checkout/CheckoutService';
import type { CheckoutStateRepository } from '@/server/checkout/CheckoutStartService';
import type { ContactRepository, OtpChallengeRecord, VerifiedContactRecord } from '@/server/contact/ContactRepository';
import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { AnswerTransition, ExperienceRecord, ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import { PaymentService } from '@/server/payments/PaymentService';
import type { PaymentGateway, VerifiedPaymentEvent } from '@/server/payments/PaymentGateway';
import type { PaymentAttemptRecord, PaymentProviderEvent, PaymentRepository } from '@/server/payments/PaymentRepository';
import type { ShippingRepository, ShippingSnapshotRecord } from '@/server/shipping/ShippingRepository';

const token = 'payment-session';
const now = new Date('2026-08-19T01:00:00.000Z');
const encrypted: EncryptedPayload = { version: 1, keyVersion: 'v1', iv: 'iv', tag: 'tag', ciphertext: 'cipher' };

class MemoryExperienceRepository implements ExperienceRepository {
  constructor(public record: ExperienceRecord) {}
  async create(_record: ExperienceRecord) {}
  async findBySessionHash(hash: string) { return hash === this.record.publicSessionHash ? this.record : null; }
  async saveAnswerAndAdvance(_transition: AnswerTransition) {}
}

class MemoryContactRepository implements ContactRepository {
  constructor(private readonly contact: VerifiedContactRecord | null) {}
  async findRecentChallenge(_experienceId: string, _emailHash: string) { return null; }
  async createChallenge(_record: OtpChallengeRecord) {}
  async findChallenge(_challengeId: string) { return null; }
  async recordFailedAttempt(_challengeId: string, _attemptsRemaining: number) {}
  async verifyContact(_input: { challengeId: string; contact: VerifiedContactRecord }) { return false; }
  async findVerifiedByExperienceId(experienceId: string) { return this.contact?.experienceId === experienceId ? this.contact : null; }
}

class MemoryShippingRepository implements ShippingRepository {
  constructor(private readonly record: ShippingSnapshotRecord | null) {}
  async upsert(record: ShippingSnapshotRecord) { return record; }
  async findByExperienceId(experienceId: string) { return this.record?.experienceId === experienceId ? this.record : null; }
}

class MemoryPaymentRepository implements PaymentRepository {
  attempts = new Map<string, PaymentAttemptRecord>();
  eventIds = new Set<string>();
  async findReusable(experienceId: string, quoteId: string) {
    return [...this.attempts.values()].find((a) => a.experienceId === experienceId && a.quoteId === quoteId && a.status === 'REDIRECTED') ?? null;
  }
  async create(record: PaymentAttemptRecord) { this.attempts.set(record.id, structuredClone(record)); return record; }
  async attachProvider(input: { attemptId: string; providerReference: string; checkoutUrl: string; updatedAt: Date }) {
    const attempt = this.attempts.get(input.attemptId)!;
    Object.assign(attempt, { providerReference: input.providerReference, checkoutUrl: input.checkoutUrl, status: 'REDIRECTED', updatedAt: input.updatedAt });
  }
  async findByProviderReference(reference: string) {
    return [...this.attempts.values()].find((a) => a.providerReference === reference) ?? null;
  }
  async recordProviderEvent(event: PaymentProviderEvent) {
    if (this.eventIds.has(event.providerEventId)) return false;
    this.eventIds.add(event.providerEventId); return true;
  }
  async markPaid(input: { attemptId: string; providerEventId: string; amountMinor: number; currency: string; paidAt: Date }) {
    const attempt = this.attempts.get(input.attemptId)!;
    if (attempt.status === 'PAID') return 'duplicate' as const;
    if (attempt.amountMinor !== input.amountMinor || attempt.currency !== input.currency) {
      attempt.status = 'EXCEPTION'; return 'mismatch' as const;
    }
    attempt.status = 'PAID'; attempt.updatedAt = input.paidAt; return 'paid' as const;
  }
  async markFailed(attemptId: string, _providerEventId: string, at: Date) {
    const attempt = this.attempts.get(attemptId)!; attempt.status = 'FAILED'; attempt.updatedAt = at;
  }
}

function fixture(options: { contact?: boolean; shipping?: boolean } = {}) {
  const experience: ExperienceRecord = {
    id: 'exp-pay', publicSessionHash: hashSessionToken(token), stage: 'COMMITMENT_READY', hookId: null,
    createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 3_600_000),
  };
  const contact: VerifiedContactRecord | null = options.contact === false ? null : {
    id: 'contact-1', experienceId: experience.id, emailHash: 'a'.repeat(64), encryptedEmail: encrypted, verifiedAt: now,
  };
  const shipping: ShippingSnapshotRecord | null = options.shipping === false ? null : {
    id: 'ship-1', experienceId: experience.id, contactId: 'contact-1', countryCode: 'GB', encryptedAddress: encrypted,
    createdAt: now, updatedAt: now,
  };
  const quotes: CheckoutQuoteRepository = { findById: vi.fn(async (id) => id === 'quote-1' ? ({
    id, experienceId: experience.id, productSlug: 'tee', variantId: 'tee-m-black', amountMinor: 5400,
    currency: 'USD', expiresAt: new Date(now.getTime() + 600_000),
  }) : null) };
  const gateway: PaymentGateway = {
    createCheckout: vi.fn(async (input) => ({
      providerReference: 'track-safe-1',
      checkoutUrl: `https://getsafepay.com/checkout/pay?beacon=track-safe-1&order_id=${input.paymentAttemptId}`,
    })),
    verifyWebhook: vi.fn(),
  };
  const payments = new MemoryPaymentRepository();
  const states: CheckoutStateRepository = { advance: vi.fn(async () => undefined) };
  const service = new PaymentService({
    experiences: new MemoryExperienceRepository(experience), quotes,
    contacts: new MemoryContactRepository(contact), shipping: new MemoryShippingRepository(shipping),
    payments, gateway, checkoutStates: states, now: () => now,
  });
  return { service, payments, gateway, states };
}

test('will not create a payment without both verified contact and shipping', async () => {
  await expect(fixture({ contact: false }).service.start({ sessionToken: token, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' }))
    .rejects.toThrow(/verified contact/i);
  await expect(fixture({ shipping: false }).service.start({ sessionToken: token, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' }))
    .rejects.toThrow(/shipping/i);
});

test('freezes exact amount/currency and moves checkout only after provider session exists', async () => {
  const { service, payments, gateway, states } = fixture();
  const result = await service.start({ sessionToken: token, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' });

  expect(result.checkoutUrl).toMatch(/^https:\/\/getsafepay\.com\//);
  const attempt = [...payments.attempts.values()][0];
  expect(attempt).toMatchObject({
    experienceId: 'exp-pay', quoteId: 'quote-1', contactId: 'contact-1', shippingSnapshotId: 'ship-1',
    amountMinor: 5400, currency: 'USD', provider: 'SAFEPAY', providerReference: 'track-safe-1', status: 'REDIRECTED',
  });
  expect(gateway.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 5400, currency: 'USD' }));
  expect(states.advance).toHaveBeenCalledWith(expect.objectContaining({ expectedStage: 'COMMITMENT_READY', nextStage: 'CHECKOUT_STARTED' }));
});

test('only a verified provider event with exact money truth can mark the attempt paid and duplicate events are idempotent', async () => {
  const { service, payments, gateway } = fixture();
  await service.start({ sessionToken: token, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' });

  const paid: VerifiedPaymentEvent = {
    providerEventId: 'evt-1', providerReference: 'track-safe-1', state: 'PAID', amountMinor: 5400,
    currency: 'USD', reference: 'SAFE-REF-1', occurredAt: now,
  };
  vi.mocked(gateway.verifyWebhook).mockReturnValue(paid);

  expect(await service.handleWebhook({ rawBody: '{}', headers: new Headers() })).toMatchObject({ kind: 'paid' });
  expect([...payments.attempts.values()][0].status).toBe('PAID');
  expect(await service.handleWebhook({ rawBody: '{}', headers: new Headers() })).toMatchObject({ kind: 'duplicate' });
});

test('authenticated payment with changed amount is quarantined instead of becoming paid', async () => {
  const { service, payments, gateway } = fixture();
  await service.start({ sessionToken: token, quoteId: 'quote-1', returnBaseUrl: 'https://issuedonce.shop' });
  vi.mocked(gateway.verifyWebhook).mockReturnValue({
    providerEventId: 'evt-mismatch', providerReference: 'track-safe-1', state: 'PAID', amountMinor: 1,
    currency: 'USD', reference: 'SAFE-REF-X', occurredAt: now,
  });

  await expect(service.handleWebhook({ rawBody: '{}', headers: new Headers() })).resolves.toMatchObject({ kind: 'exception' });
  expect([...payments.attempts.values()][0].status).toBe('EXCEPTION');
});
