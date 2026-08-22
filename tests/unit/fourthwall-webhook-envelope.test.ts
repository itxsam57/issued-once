import { describe, expect, test } from 'vitest';
import { parseFourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';

const providerEvent = {
  id: 'weve_1',
  webhookId: 'wcon_1',
  shopId: 'sh_1',
  type: 'ORDER_PLACED',
  apiVersion: 'V1',
  createdAt: '2026-08-18T10:30:00.000+00:00',
  testMode: false,
  data: {
    id: 'order_1',
    email: 'private@example.com',
    message: 'private order note',
    shipping: {
      name: 'Private Person',
      address1: '1 Private Street',
    },
    amounts: {
      subtotal: { value: 54, currency: 'USD' },
    },
    metadata: {
      io_quote_id: 'quote-opaque-1',
      ignored_number: 17,
    },
  },
};

describe('parseFourthwallWebhookEnvelope', () => {
  test('returns only the envelope, order id, and string metadata needed by ISSUED ONCE', () => {
    const parsed = parseFourthwallWebhookEnvelope(
      Buffer.from(JSON.stringify(providerEvent), 'utf8'),
    );

    expect(parsed).toEqual({
      id: 'weve_1',
      webhookId: 'wcon_1',
      shopId: 'sh_1',
      type: 'ORDER_PLACED',
      apiVersion: 'V1',
      createdAt: '2026-08-18T10:30:00.000+00:00',
      testMode: false,
      orderId: 'order_1',
      metadata: {
        io_quote_id: 'quote-opaque-1',
      },
    });

    expect(JSON.stringify(parsed)).not.toMatch(
      /private@example\.com|private order note|Private Person|Private Street|subtotal/i,
    );
  });

  test('rejects malformed required envelope fields', () => {
    const invalid = {
      ...providerEvent,
      id: '',
    };

    expect(() =>
      parseFourthwallWebhookEnvelope(Buffer.from(JSON.stringify(invalid), 'utf8')),
    ).toThrow();
  });
});
