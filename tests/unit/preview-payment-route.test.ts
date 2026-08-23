import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, createPaymentServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/payments/create/route';
import { hashSessionToken } from '@/server/http/sessionToken';
import { getPreviewStore } from '@/server/preview/PreviewExperienceRepository';

const token = 'preview-route-session';
const hash = hashSessionToken(token);
const experienceId = '33333333-3333-4333-8333-333333333333';

describe('POST /api/payments/create visual preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '1');
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: token }) });
    createPaymentServiceMock.mockImplementation(() => {
      throw new Error('production payment runtime must stay dark in visual preview');
    });

    const store = getPreviewStore();
    store.experiences.clear();
    store.answers.clear();
    store.physicalSelections.clear();
    store.checkoutQuotes.clear();
    store.questionAssignments.clear();
    store.experiences.set(hash, {
      id: experienceId,
      publicSessionHash: hash,
      stage: 'COMMITMENT_READY',
      hookId: 'preview-route',
      createdAt: new Date('2026-08-23T04:00:00.000Z'),
      updatedAt: new Date('2026-08-23T04:00:00.000Z'),
      expiresAt: new Date('2026-09-23T04:00:00.000Z'),
    });
    store.checkoutQuotes.set('quote-preview-route', {
      id: 'quote-preview-route',
      experienceId,
      productSlug: 'issued-once-tee',
      variantId: 'tee-m-bone',
      amountMinor: 3200,
      currency: 'USD',
      expiresAt: new Date('2026-08-24T04:00:00.000Z'),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the local preview transition and never opens the Safepay runtime', async () => {
    const response = await POST(new Request('http://localhost:3000/api/payments/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteId: 'quote-preview-route' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkoutUrl: '/begin?payment=preview',
      paymentAttemptId: `preview:${experienceId}`,
    });
    expect(createPaymentServiceMock).not.toHaveBeenCalled();
    expect(getPreviewStore().experiences.get(hash)?.stage).toBe('CHECKOUT_STARTED');
  });
});
