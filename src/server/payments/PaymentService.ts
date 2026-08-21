import { randomUUID } from 'node:crypto';
import type { CheckoutQuoteRecord, CheckoutQuoteRepository } from '@/server/checkout/CheckoutService';
import type { CheckoutStateRepository } from '@/server/checkout/CheckoutStartService';
import type { ContactRepository } from '@/server/contact/ContactRepository';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { ShippingRepository } from '@/server/shipping/ShippingRepository';
import type { PaymentGateway } from './PaymentGateway';
import type { PaymentAttemptRecord, PaymentRepository } from './PaymentRepository';

type PaymentQuoteRepository = CheckoutQuoteRepository & {
  findLatestByExperienceId(experienceId: string): Promise<CheckoutQuoteRecord | null>;
};

type Dependencies = {
  experiences: Pick<ExperienceRepository, 'findBySessionHash'>;
  quotes: PaymentQuoteRepository;
  contacts: ContactRepository;
  shipping: ShippingRepository;
  payments: PaymentRepository;
  gateway: PaymentGateway;
  checkoutStates: CheckoutStateRepository;
  now?: () => Date;
};

function safeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Payment return origin must use HTTPS');
  return url.origin;
}

export class PaymentService {
  private readonly now: () => Date;
  constructor(private readonly dependencies: Dependencies) { this.now = dependencies.now ?? (() => new Date()); }

  private async returnRedirectedAttempt(input: {
    experienceId: string;
    experienceStage: 'COMMITMENT_READY' | 'CHECKOUT_STARTED';
    attempt: PaymentAttemptRecord;
  }): Promise<{ checkoutUrl: string; paymentAttemptId: string }> {
    if (!input.attempt.checkoutUrl) throw new Error('Redirected payment is missing its checkout URL');
    if (input.experienceStage === 'COMMITMENT_READY') {
      await this.dependencies.checkoutStates.advance({
        experienceId: input.experienceId,
        expectedStage: 'COMMITMENT_READY',
        nextStage: 'CHECKOUT_STARTED',
        updatedAt: this.now(),
      });
    }
    return { checkoutUrl: input.attempt.checkoutUrl, paymentAttemptId: input.attempt.id };
  }

  async start(input: { sessionToken: string; quoteId: string; returnBaseUrl: string }): Promise<{ checkoutUrl: string; paymentAttemptId: string }> {
    const experience = await this.dependencies.experiences.findBySessionHash(hashSessionToken(input.sessionToken));
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'COMMITMENT_READY' && experience.stage !== 'CHECKOUT_STARTED') throw new Error('Payment is not unlocked');

    const quote = await this.dependencies.quotes.findById(input.quoteId);
    if (!quote || quote.experienceId !== experience.id) throw new Error('Quote does not belong to this experience');
    const latest = await this.dependencies.quotes.findLatestByExperienceId(experience.id);
    if (!latest || latest.id !== quote.id) throw new Error('Payment requires the latest quote; this quote was superseded');
    if (quote.expiresAt.getTime() <= this.now().getTime()) throw new Error('Quote expired');
    if (!Number.isSafeInteger(quote.amountMinor) || quote.amountMinor <= 0) throw new Error('Quote amount is invalid');
    const currency = quote.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Quote currency is invalid');

    const contact = await this.dependencies.contacts.findVerifiedByExperienceId(experience.id);
    if (!contact) throw new Error('Verified contact is required before payment');
    const shipping = await this.dependencies.shipping.findByExperienceId(experience.id);
    if (!shipping || shipping.contactId !== contact.id) throw new Error('Shipping is required before payment');

    const reusable = await this.dependencies.payments.findReusable(experience.id, quote.id);
    if (reusable?.checkoutUrl) {
      return this.returnRedirectedAttempt({
        experienceId: experience.id,
        experienceStage: experience.stage,
        attempt: reusable,
      });
    }
    if (experience.stage === 'CHECKOUT_STARTED') throw new Error('Checkout has already started');

    const now = this.now();
    const proposed: PaymentAttemptRecord = {
      id: randomUUID(), experienceId: experience.id, quoteId: quote.id, contactId: contact.id,
      shippingSnapshotId: shipping.id, provider: 'SAFEPAY', providerReference: null, checkoutUrl: null,
      amountMinor: quote.amountMinor, currency, status: 'CREATED', createdAt: now, updatedAt: now,
    };
    const attempt = await this.dependencies.payments.create(proposed);
    if (attempt.id !== proposed.id) {
      if (attempt.checkoutUrl) {
        return this.returnRedirectedAttempt({
          experienceId: experience.id,
          experienceStage: experience.stage,
          attempt,
        });
      }
      throw new Error('Payment initialization is already in progress');
    }

    const origin = safeOrigin(input.returnBaseUrl);
    let checkout: Awaited<ReturnType<PaymentGateway['createCheckout']>>;
    try {
      checkout = await this.dependencies.gateway.createCheckout({
        paymentAttemptId: attempt.id,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        returnUrl: `${origin}/payment/return`,
        cancelUrl: `${origin}/begin?payment=cancelled`,
      });
    } catch (error) {
      await this.dependencies.payments.markFailed(
        attempt.id,
        `checkout-init:${attempt.id}`,
        this.now(),
      );
      throw error;
    }

    const checkoutUrl = new URL(checkout.checkoutUrl);
    if (checkoutUrl.protocol !== 'https:') {
      await this.dependencies.payments.markFailed(
        attempt.id,
        `checkout-url:${attempt.id}`,
        this.now(),
      );
      throw new Error('Safepay checkout URL is invalid');
    }

    await this.dependencies.payments.attachProvider({
      attemptId: attempt.id, providerReference: checkout.providerReference,
      checkoutUrl: checkoutUrl.toString(), updatedAt: this.now(),
    });
    await this.dependencies.checkoutStates.advance({
      experienceId: experience.id, expectedStage: 'COMMITMENT_READY', nextStage: 'CHECKOUT_STARTED', updatedAt: this.now(),
    });
    return { checkoutUrl: checkoutUrl.toString(), paymentAttemptId: attempt.id };
  }

  async handleWebhook(input: { rawBody: string; headers: Headers }): Promise<
    | { kind: 'paid'; paymentAttemptId: string }
    | { kind: 'refunded'; paymentAttemptId: string }
    | { kind: 'failed'; paymentAttemptId: string }
    | { kind: 'pending'; paymentAttemptId: string }
    | { kind: 'duplicate'; paymentAttemptId?: string }
    | { kind: 'exception'; paymentAttemptId?: string }
  > {
    const event = this.dependencies.gateway.verifyWebhook(input);
    const fresh = await this.dependencies.payments.recordProviderEvent({
      provider: 'SAFEPAY', providerEventId: event.providerEventId, providerReference: event.providerReference,
      state: event.state, amountMinor: event.amountMinor, currency: event.currency, reference: event.reference, receivedAt: this.now(),
    });
    const attempt = await this.dependencies.payments.findByProviderReference(event.providerReference);
    if (!attempt) return { kind: fresh ? 'exception' : 'duplicate' };

    if (event.state === 'PAID') {
      const outcome = await this.dependencies.payments.markPaid({
        attemptId: attempt.id, providerEventId: event.providerEventId, amountMinor: event.amountMinor,
        currency: event.currency, paidAt: event.occurredAt,
      });
      if (outcome === 'paid') return { kind: 'paid', paymentAttemptId: attempt.id };
      if (outcome === 'duplicate') return { kind: 'duplicate', paymentAttemptId: attempt.id };
      return { kind: 'exception', paymentAttemptId: attempt.id };
    }
    if (event.state === 'REFUNDED') {
      const outcome = await this.dependencies.payments.markRefunded({
        attemptId: attempt.id,
        amountMinor: event.amountMinor,
        currency: event.currency,
        refundedAt: event.occurredAt,
      });
      if (outcome === 'refunded' || outcome === 'duplicate') {
        return { kind: 'refunded', paymentAttemptId: attempt.id };
      }
      return { kind: 'exception', paymentAttemptId: attempt.id };
    }
    if (event.state === 'FAILED') {
      await this.dependencies.payments.markFailed(attempt.id, event.providerEventId, event.occurredAt);
      return { kind: 'failed', paymentAttemptId: attempt.id };
    }
    return { kind: 'pending', paymentAttemptId: attempt.id };
  }
}
