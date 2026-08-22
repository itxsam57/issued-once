import { createHmac } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { SafepayPaymentGateway } from '@/server/payments/SafepayPaymentGateway';

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
