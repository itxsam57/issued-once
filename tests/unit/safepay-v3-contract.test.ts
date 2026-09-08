import { createHmac } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { SafepayPaymentGateway } from '@/server/payments/SafepayPaymentGateway';

function gateway(fetchImpl: typeof fetch) {
  return new SafepayPaymentGateway({
    environment: 'sandbox',
    apiKey: 'sec_test_123',
    apiSecret: 'sec_private_test_456',
    webhookSecret: 'webhook-secret',
    fetchImpl,
  } as ConstructorParameters<typeof SafepayPaymentGateway>[0] & { apiSecret: string });
}

test('creates a Safepay v3 payment session in exact minor units, mints a TBT, and returns the hosted checkout URL', async () => {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url);
    if (requestUrl === 'https://sandbox.api.getsafepay.com/order/payments/v3/') {
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('x-sfpy-merchant-secret')).toBe('sec_private_test_456');
      expect(JSON.parse(String(init?.body))).toEqual({
        merchant_api_key: 'sec_test_123',
        intent: 'CYBERSOURCE',
        mode: 'payment',
        entry_mode: 'raw',
        currency: 'USD',
        amount: 3200,
        metadata: { order_id: 'attempt-opaque-1' },
        include_fees: false,
      });
      return new Response(JSON.stringify({
        data: { tracker: { token: 'track_v3_abc123' } },
        status: { errors: [], message: 'success' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (requestUrl === 'https://sandbox.api.getsafepay.com/client/passport/v1/token') {
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('x-sfpy-merchant-secret')).toBe('sec_private_test_456');
      return new Response(JSON.stringify({ data: 'tbt_test_abc' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected Safepay request: ${requestUrl}`);
  }) as unknown as typeof fetch;

  const result = await gateway(fetchImpl).createCheckout({
    paymentAttemptId: 'attempt-opaque-1',
    amountMinor: 3200,
    currency: 'USD',
    returnUrl: 'https://issuedonce.shop/payment/return',
    cancelUrl: 'https://issuedonce.shop/begin?payment=cancelled',
  });

  expect(result.providerReference).toBe('track_v3_abc123');
  const checkout = new URL(result.checkoutUrl);
  expect(checkout.origin + checkout.pathname).toBe('https://sandbox.api.getsafepay.com/embedded');
  expect(checkout.searchParams.get('environment')).toBe('sandbox');
  expect(checkout.searchParams.get('tracker')).toBe('track_v3_abc123');
  expect(checkout.searchParams.get('tbt')).toBe('tbt_test_abc');
  expect(checkout.searchParams.get('source')).toBe('hosted');
  expect(checkout.searchParams.get('redirect_url')).toBe('https://issuedonce.shop/payment/return');
  expect(checkout.searchParams.get('cancel_url')).toBe('https://issuedonce.shop/begin?payment=cancelled');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('verifies the original USD quote from Reporter even when Safepay base settlement is PKR', async () => {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('https://sandbox.api.getsafepay.com/reporter/api/v1/payments/track_paid_fx');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(new Headers(init?.headers).get('x-sfpy-merchant-secret')).toBe('sec_private_test_456');
    return new Response(JSON.stringify({
      data: {
        tracker: {
          token: 'track_paid_fx',
          client: 'sec_test_123',
          state: 'TRACKER_ENDED',
          purchase_totals: {
            quote_amount: { currency: 'USD', amount: 3200 },
            base_amount: { currency: 'PKR', amount: 880056 },
            conversion_rate: { base_currency: 'PKR', quote_currency: 'USD', rate: 275.0175 },
          },
        },
      },
      status: { errors: [], message: 'success' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

  await expect(gateway(fetchImpl).verifyTracker({
    providerReference: 'track_paid_fx',
    amountMinor: 3200,
    currency: 'USD',
  })).resolves.toBe(true);
});

test('verifies Safepay 2.0.0 payment.succeeded HMAC over the raw body and preserves settlement money for tracker re-verification', () => {
  const fetchImpl = vi.fn() as unknown as typeof fetch;
  const body = {
    token: 'evt_v2_paid_1',
    version: '2.0.0',
    merchant_api_key: 'sec_test_123',
    type: 'payment.succeeded',
    endpoint: 'https://issuedonce.shop/api/payment/webhook',
    data: {
      tracker: 'track_paid_fx',
      intent: 'CYBERSOURCE',
      state: 'TRACKER_ENDED',
      net: 851000,
      fee: 29056,
      amount: 880056,
      currency: 'PKR',
      metadata: { order_id: 'attempt-opaque-1' },
      charged_at: { seconds: 1787385600, nanos: 0 },
    },
    created_at: { seconds: 1787385600, nanos: 0 },
  };
  const rawBody = JSON.stringify(body);
  const signature = createHmac('sha512', 'webhook-secret').update(Buffer.from(rawBody)).digest('hex');

  expect(gateway(fetchImpl).verifyWebhook({
    rawBody,
    headers: new Headers({ 'x-sfpy-signature': signature }),
  })).toEqual({
    providerEventId: 'evt_v2_paid_1',
    providerReference: 'track_paid_fx',
    state: 'PAID',
    amountMinor: 880056,
    currency: 'PKR',
    reference: 'attempt-opaque-1',
    occurredAt: new Date(1787385600 * 1000),
  });
});
