import { expect, test, vi } from 'vitest';
import { SafepayPaymentGateway } from '@/server/payments/SafepayPaymentGateway';

function gateway(state: 'TRACKER_REFUNDED' | 'TRACKER_PARTIAL_REFUND') {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('https://api.getsafepay.com/reporter/api/v1/payments/track_refund_123');
    expect(new Headers(init?.headers).get('x-sfpy-merchant-secret')).toBe('secret_live');
    return new Response(JSON.stringify({
      data: {
        tracker: {
          token: 'track_refund_123',
          client: 'sec_live',
          state,
          purchase_totals: {
            quote_amount: { currency: 'USD', amount: 5400 },
            base_amount: { currency: 'PKR', amount: 1490000 },
          },
        },
      },
      status: { errors: [], message: 'success' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const instance = new SafepayPaymentGateway({
    environment: 'production',
    apiKey: 'sec_live',
    apiSecret: 'secret_live',
    webhookSecret: 'webhook_live',
    fetchImpl: fetchImpl as typeof fetch,
  });
  const verifyRefundedTracker = (instance as unknown as {
    verifyRefundedTracker(input: { providerReference: string; amountMinor: number; currency: string }): Promise<boolean>;
  }).verifyRefundedTracker?.bind(instance);
  return { verifyRefundedTracker };
}

test('confirms only a full Safepay refund for the exact original quote', async () => {
  const { verifyRefundedTracker } = gateway('TRACKER_REFUNDED');
  expect(verifyRefundedTracker).toBeTypeOf('function');
  await expect(verifyRefundedTracker!({
    providerReference: 'track_refund_123', amountMinor: 5400, currency: 'USD',
  })).resolves.toBe(true);
});

test('does not treat a partial Safepay refund as a full refunded order', async () => {
  const { verifyRefundedTracker } = gateway('TRACKER_PARTIAL_REFUND');
  expect(verifyRefundedTracker).toBeTypeOf('function');
  await expect(verifyRefundedTracker!({
    providerReference: 'track_refund_123', amountMinor: 5400, currency: 'USD',
  })).resolves.toBe(false);
});
