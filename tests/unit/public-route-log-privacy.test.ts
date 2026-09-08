import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
  cookiesMock,
  createCheckoutStartServiceMock,
  createPaymentServiceMock,
  createShippingServiceMock,
  createReferralServiceMock,
  getExperienceRepositoryMock,
  getQuestionSelectionServiceMock,
  bootstrapMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createCheckoutStartServiceMock: vi.fn(),
  createPaymentServiceMock: vi.fn(),
  createShippingServiceMock: vi.fn(),
  createReferralServiceMock: vi.fn(),
  getExperienceRepositoryMock: vi.fn(),
  getQuestionSelectionServiceMock: vi.fn(),
  bootstrapMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/server/checkout/runtimeCheckout', () => ({
  createCheckoutStartService: createCheckoutStartServiceMock,
  CheckoutRuntimeUnavailableError: class CheckoutRuntimeUnavailableError extends Error {},
}));

vi.mock('@/server/payments/runtimePayments', () => ({
  createPaymentService: createPaymentServiceMock,
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));

vi.mock('@/server/contact/runtimeContact', () => ({
  createShippingService: createShippingServiceMock,
  ContactRuntimeUnavailableError: class ContactRuntimeUnavailableError extends Error {},
}));

vi.mock('@/server/referrals/runtimeReferrals', () => ({
  createReferralService: createReferralServiceMock,
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));

vi.mock('@/server/experience/runtimeRepository', () => ({
  getExperienceRepository: getExperienceRepositoryMock,
  PersistentExperienceRepositoryUnavailableError:
    class PersistentExperienceRepositoryUnavailableError extends Error {},
}));

vi.mock('@/server/questions/runtimeQuestions', () => ({
  getQuestionSelectionService: getQuestionSelectionServiceMock,
  QuestionAssignmentUnavailableError: class QuestionAssignmentUnavailableError extends Error {},
}));

vi.mock('@/server/questions/InterviewBootstrapService', () => ({
  InterviewBootstrapService: class InterviewBootstrapService {
    bootstrap = bootstrapMock;
  },
}));

import { POST as startCheckout } from '@/app/api/checkout/start/route';
import { POST as createPayment } from '@/app/api/payments/create/route';
import { POST as saveShipping } from '@/app/api/shipping/route';
import { POST as applyReferral } from '@/app/api/referrals/apply/route';
import { POST as startExperience } from '@/app/api/experience/start/route';

function renderedConsoleCalls(calls: unknown[][]): string {
  return calls.flat().map((value) => String(value)).join('\n');
}

function cookieStore() {
  return {
    get: vi.fn().mockReturnValue({ value: 'session-token' }),
    set: vi.fn(),
  };
}

describe('public API route log privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    cookiesMock.mockResolvedValue(cookieStore());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('checkout start keeps unknown provider details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'checkout-provider-secret-sentinel';
    createCheckoutStartServiceMock.mockReturnValue({
      start: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await startCheckout(new Request('https://issuedonce.shop/api/checkout/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteId: 'quote-1' }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Checkout could not be opened' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('checkout start failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('payment start keeps unknown provider details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'payment-provider-secret-sentinel';
    createPaymentServiceMock.mockReturnValue({
      start: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await createPayment(new Request('https://issuedonce.shop/api/payments/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteId: 'quote-1' }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Payment could not be opened' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('payment start failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('shipping save keeps unknown provider details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'fulfillment-provider-secret-sentinel';
    createShippingServiceMock.mockReturnValue({
      save: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await saveShipping(new Request('https://issuedonce.shop/api/shipping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipientName: 'Test Customer',
        line1: '1 Test Street',
        city: 'Test City',
        postalCode: '12345',
        countryCode: 'US',
      }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Shipping details failed' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('shipping save failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('referral apply keeps unknown provider details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'referral-provider-secret-sentinel';
    createReferralServiceMock.mockReturnValue({
      applyToQuote: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await applyReferral(new Request('https://issuedonce.shop/api/referrals/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteId: 'quote-1' }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Referral could not be applied' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('referral application failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });

  test('experience start keeps unknown bootstrap details out of logs while preserving its 500 contract', async () => {
    const sentinel = 'experience-provider-secret-sentinel';
    getExperienceRepositoryMock.mockImplementation(() => {
      throw new Error(sentinel);
    });
    getQuestionSelectionServiceMock.mockReturnValue({});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await startExperience();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Interview could not begin' });
    expect(renderedConsoleCalls(consoleError.mock.calls)).toContain('public interview bootstrap failed');
    expect(renderedConsoleCalls(consoleError.mock.calls)).not.toContain(sentinel);
  });
});
