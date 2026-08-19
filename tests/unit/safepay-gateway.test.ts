import { createHmac } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { SafepayPaymentGateway } from '@/server/payments/SafepayPaymentGateway';

function signedWebhook(secret: string, data: object) {
  const signature = createHmac('sha512', secret)
    .update(Buffer.from(JSON.stringify(data)))
    .digest('hex');
  return {
    rawBody: JSON.stringify({ data }),
    headers: new Headers({ 'x-sfpy-signature': signature }),
  };
}

test('converts exact internal minor units to Safepay major currency units when creating the tracker', async () => {
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: 54.01,
      client: 'sec_test_123',
      currency: 'USD',
      environment: 'sandbox',
    });
    return new Response(JSON.stringify({ data: { token: 'track_abc123' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const gateway = new SafepayPaymentGateway({
    environment: 'sandbox',
    apiKey: 'sec_test_123',
    webhookSecret: 'webhook-secret',
    fetchImpl: fetchImpl as typeof fetch,
  });

  const result = await gateway.createCheckout({
    paymentAttemptId: 'attempt-opaque-1',
    amountMinor: 5401,
    currency: 'USD',
    returnUrl: 'https://issuedonce.shop/payment/return',
    cancelUrl: 'https://issuedonce.shop/begin?payment=cancelled',
  });

  expect(fetchImpl).toHaveBeenCalledWith(
    'https://sandbox.api.getsafepay.com/order/v1/init',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(result.providerReference).toBe('track_abc123');
  const checkout = new URL(result.checkoutUrl);
  expect(checkout.origin + checkout.pathname).toBe('https://sandbox.api.getsafepay.com/checkout/pay');
  expect(checkout.searchParams.get('beacon')).toBe('track_abc123');
  expect(checkout.searchParams.get('order_id')).toBe('attempt-opaque-1');
  expect(checkout.searchParams.get('webhooks')).toBe('true');
});

test('verifies merchant webhook HMAC and converts decimal Safepay major-unit money to integer minor units', () => {
  const gateway = new SafepayPaymentGateway({
    environment: 'production', apiKey: 'sec_live', webhookSecret: 'foo',
    fetchImpl: vi.fn() as unknown as typeof fetch,
  });
  const data = {
    client_id: 'sec_live',
    created_at: '2026-08-19T01:02:03Z',
    updated_at: '2026-08-19T01:02:04Z',
    token: 'evt-token-1',
    type: 'payment:created',
    notification: {
      amount: '54.01', currency: 'USD', state: 'PAID', tracker: 'track_paid_1', reference: 'SAFE-001',
      metadata: { source: 'custom' },
    },
  };

  expect(gateway.verifyWebhook(signedWebhook('foo', data))).toEqual({
    providerEventId: 'evt-token-1',
    providerReference: 'track_paid_1',
    state: 'PAID',
    amountMinor: 5401,
    currency: 'USD',
    reference: 'SAFE-001',
    occurredAt: new Date('2026-08-19T01:02:04Z'),
  });
});

test('rejects a webhook whose Safepay signature does not match body.data', () => {
  const gateway = new SafepayPaymentGateway({
    environment: 'production', apiKey: 'sec_live', webhookSecret: 'foo',
    fetchImpl: vi.fn() as unknown as typeof fetch,
  });
  expect(() => gateway.verifyWebhook({
    rawBody: JSON.stringify({ data: { token: 'tampered' } }),
    headers: new Headers({ 'x-sfpy-signature': '00'.repeat(64) }),
  })).toThrow(/signature/i);
});
