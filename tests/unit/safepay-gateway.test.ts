import { createHmac } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { SafepayPaymentGateway } from '@/server/payments/SafepayPaymentGateway';

// Regression contract: tracker verification uses Safepay's current Reporter v1 route.
function gateway(overrides: Partial<ConstructorParameters<typeof SafepayPaymentGateway>[0]> = {}) {
  return new SafepayPaymentGateway({
    environment: 'production',
    apiKey: 'sec_live',
    apiSecret: 'secret_live',
    webhookSecret: 'foo',
    fetchImpl: vi.fn() as unknown as typeof fetch,
    ...overrides,
  });
}

function signedLegacyWebhook(secret: string, data: object) {
  const signature = createHmac('sha512', secret)
    .update(Buffer.from(JSON.stringify(data)))
    .digest('hex');
  return {
    rawBody: JSON.stringify({ data }),
    headers: new Headers({ 'x-sfpy-signature': signature }),
  };
}

test('keeps strict legacy webhook verification for already-created v1 trackers during the migration window', () => {
  const data = {
    client_id: 'sec_live',
    created_at: '2026-08-19T01:02:03Z',
    updated_at: '2026-08-19T01:02:04Z',
    token: 'evt-token-1',
    type: 'payment:created',
    notification: {
      amount: '54.01', currency: 'USD', state: 'PAID', tracker: 'track_paid_1', reference: 'SAFE-001',
    },
  };

  expect(gateway().verifyWebhook(signedLegacyWebhook('foo', data))).toEqual({
    providerEventId: 'evt-token-1',
    providerReference: 'track_paid_1',
    state: 'PAID',
    amountMinor: 5401,
    currency: 'USD',
    reference: 'SAFE-001',
    occurredAt: new Date('2026-08-19T01:02:04Z'),
  });
});

test('rejects a webhook whose Safepay signature does not match the raw event', () => {
  expect(() => gateway().verifyWebhook({
    rawBody: JSON.stringify({
      token: 'evt_v2',
      version: '2.0.0',
      merchant_api_key: 'sec_live',
      type: 'payment.succeeded',
      data: { tracker: 'track_1', amount: 1000, currency: 'USD' },
    }),
    headers: new Headers({ 'x-sfpy-signature': '00'.repeat(64) }),
  })).toThrow(/signature/i);
});

test('rejects parsed non-object webhook bodies as invalid input', () => {
  expect(() => gateway().verifyWebhook({
    rawBody: 'null',
    headers: new Headers(),
  })).toThrow(/webhook body is invalid/i);
});

test('fails closed when Reporter does not confirm the exact original quote', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    data: {
      tracker: {
        token: 'track_paid_1',
        client: 'sec_live',
        state: 'TRACKER_ENDED',
        purchase_totals: {
          quote_amount: { currency: 'USD', amount: 3199 },
          base_amount: { currency: 'PKR', amount: 880056 },
        },
      },
    },
    status: { errors: [], message: 'success' },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  await expect(gateway({ fetchImpl: fetchImpl as typeof fetch }).verifyTracker({
    providerReference: 'track_paid_1',
    amountMinor: 3200,
    currency: 'USD',
  })).resolves.toBe(false);
});

test('verifies trackers through Safepay Reporter v1', async () => {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('https://api.getsafepay.com/reporter/api/v1/payments/track_paid_1');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(new Headers(init?.headers).get('x-sfpy-merchant-secret')).toBe('secret_live');
    return new Response(JSON.stringify({
      data: {
        tracker: {
          token: 'track_paid_1',
          client: 'sec_live',
          state: 'TRACKER_ENDED',
          purchase_totals: {
            quote_amount: { currency: 'USD', amount: 3200 },
            base_amount: { currency: 'PKR', amount: 880056 },
          },
        },
      },
      status: { errors: [], message: 'success' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await expect(gateway({ fetchImpl: fetchImpl as typeof fetch }).verifyTracker({
    providerReference: 'track_paid_1',
    amountMinor: 3200,
    currency: 'USD',
  })).resolves.toBe(true);
});

test('verifies only a full original-quote refund through Safepay Reporter v1', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    data: {
      tracker: {
        token: 'track_paid_1',
        client: 'sec_live',
        state: 'TRACKER_REFUNDED',
        purchase_totals: {
          quote_amount: { currency: 'USD', amount: 3200 },
          base_amount: { currency: 'PKR', amount: 880056 },
        },
      },
    },
    status: { errors: [], message: 'success' },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  await expect(gateway({ fetchImpl: fetchImpl as typeof fetch }).verifyRefundedTracker({
    providerReference: 'track_paid_1',
    amountMinor: 3200,
    currency: 'USD',
  })).resolves.toBe(true);
});

test('explicitly enables Safepay webhooks on every hosted checkout URL', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: { tracker: { token: 'track_checkout_1' } },
      status: { errors: [] },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: 'passport-token',
      status: { errors: [] },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const result = await gateway({ fetchImpl: fetchImpl as typeof fetch }).createCheckout({
    paymentAttemptId: '11111111-1111-4111-8111-111111111111',
    amountMinor: 3200,
    currency: 'USD',
    returnUrl: 'https://issuedonce.shop/payment/return',
    cancelUrl: 'https://issuedonce.shop/payment/cancel',
  });

  expect(new URL(result.checkoutUrl).searchParams.get('webhooks')).toBe('true');
});
