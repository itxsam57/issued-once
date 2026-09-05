import { beforeEach, describe, expect, it } from 'vitest';
import { hashSessionToken } from '@/server/http/sessionToken';
import { PreviewPaymentStartService } from '@/server/preview/PreviewPaymentStartService';
import { getPreviewStore } from '@/server/preview/PreviewExperienceRepository';

const token = 'preview-repeat-payment-token';
const hash = hashSessionToken(token);
const experienceId = '11111111-1111-4111-8111-111111111111';

function seed(stage: 'COMMITMENT_READY' | 'CHECKOUT_STARTED' | 'PROFILE_COMPLETE' = 'COMMITMENT_READY') {
  const store = getPreviewStore();
  store.experiences.set(hash, {
    id: experienceId,
    publicSessionHash: hash,
    stage,
    hookId: 'repeat-e2e',
    createdAt: new Date('2026-08-23T04:00:00.000Z'),
    updatedAt: new Date('2026-08-23T04:00:00.000Z'),
    expiresAt: new Date('2026-09-23T04:00:00.000Z'),
  });
  store.checkoutQuotes.set('quote-preview', {
    id: 'quote-preview',
    experienceId,
    productSlug: 'issued-once-tee',
    variantId: 'tee-m-bone',
    amountMinor: 3200,
    currency: 'USD',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  });
  return store;
}

describe('PreviewPaymentStartService', () => {
  beforeEach(() => {
    const store = getPreviewStore();
    store.experiences.clear();
    store.answers.clear();
    store.physicalSelections.clear();
    store.checkoutQuotes.clear();
    store.questionAssignments.clear();
  });

  it('moves only the preview order from commitment to checkout-started and returns a local redirect', async () => {
    const store = seed();
    const result = await new PreviewPaymentStartService().start({
      sessionToken: token,
      quoteId: 'quote-preview',
    });

    expect(result.checkoutUrl).toBe('/begin?payment=preview');
    expect(result.paymentAttemptId).toBe(`preview:${experienceId}`);
    expect(store.experiences.get(hash)?.stage).toBe('CHECKOUT_STARTED');
  });

  it('is idempotent for the same preview checkout and never creates a second attempt identity', async () => {
    const store = seed('CHECKOUT_STARTED');
    const result = await new PreviewPaymentStartService().start({
      sessionToken: token,
      quoteId: 'quote-preview',
    });

    expect(result.paymentAttemptId).toBe(`preview:${experienceId}`);
    expect(store.experiences.get(hash)?.stage).toBe('CHECKOUT_STARTED');
  });

  it('rejects a quote from another experience and refuses non-payment-ready stages', async () => {
    const store = seed();
    store.checkoutQuotes.set('quote-other', {
      ...store.checkoutQuotes.get('quote-preview')!,
      id: 'quote-other',
      experienceId: '22222222-2222-4222-8222-222222222222',
    });
    const service = new PreviewPaymentStartService();

    await expect(service.start({ sessionToken: token, quoteId: 'quote-other' })).rejects.toThrow(
      'Quote does not belong to this experience',
    );

    store.experiences.get(hash)!.stage = 'PROFILE_COMPLETE';
    await expect(service.start({ sessionToken: token, quoteId: 'quote-preview' })).rejects.toThrow(
      'Payment is not unlocked',
    );
  });
});
