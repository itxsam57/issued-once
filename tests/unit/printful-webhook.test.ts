import { createHmac } from 'node:crypto';
import { expect, test } from 'vitest';
import { PrintfulWebhookVerifier } from '@/server/manufacturing/PrintfulWebhookVerifier';

const secretHex = Buffer.alloc(32, 7).toString('hex');
const publicKey = 'cHJpbnRmdWwtcHVibGljLWtleQ==';

function signed(body: object) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac('sha256', Buffer.from(secretHex, 'hex')).update(rawBody).digest('hex');
  return {
    rawBody,
    headers: new Headers({
      'x-pf-webhook-public-key': publicKey,
      'x-pf-webhook-signature': signature,
    }),
  };
}

test('requires even hexadecimal Printful webhook secret with at least 32 bytes', () => {
  expect(() => new PrintfulWebhookVerifier({ publicKey, secretKeyHex: 'not-hex' })).toThrow(/hexadecimal/i);
  expect(() => new PrintfulWebhookVerifier({ publicKey, secretKeyHex: 'aa'.repeat(16) })).toThrow(/32 bytes/i);
});

test('verifies shipment_sent and derives stable event identity that ignores Printful retry count', () => {
  const verifier = new PrintfulWebhookVerifier({ publicKey, secretKeyHex: secretHex });
  const base = {
    type: 'shipment_sent',
    occurred_at: '2026-08-19T03:00:00Z',
    retries: 0,
    store_id: 123,
    data: {
      shipment: { id: 456, tracking_number: 'TRACK-1', tracking_url: 'https://carrier.example/T1', shipped_at: '2026-08-19T03:00:00Z', delivered_at: null },
      order: { id: 987654, external_id: 'IO-ABCD-EFGH', status: 'fulfilled' },
    },
  };
  const first = verifier.verify(signed(base));
  const retry = verifier.verify(signed({ ...base, retries: 3 }));

  expect(first).toMatchObject({
    type: 'SHIPMENT_SENT', providerOrderId: '987654', externalIssueCode: 'IO-ABCD-EFGH',
    trackingNumber: 'TRACK-1', trackingUrl: 'https://carrier.example/T1',
  });
  expect(retry.providerEventId).toBe(first.providerEventId);
});

test('parses delivered event and rejects wrong public key/signature', () => {
  const verifier = new PrintfulWebhookVerifier({ publicKey, secretKeyHex: secretHex });
  const body = {
    type: 'shipment_delivered', occurred_at: '2026-08-22T12:00:00Z', retries: 0, store_id: 123,
    data: { shipment: { id: 456, tracking_number: 'TRACK-1', tracking_url: 'https://carrier.example/T1', delivered_at: '2026-08-22T11:59:00Z' }, order: { id: 987654, external_id: 'IO-ABCD-EFGH', status: 'fulfilled' } },
  };
  expect(verifier.verify(signed(body)).type).toBe('SHIPMENT_DELIVERED');

  const bad = signed(body);
  bad.headers.set('x-pf-webhook-public-key', 'wrong');
  expect(() => verifier.verify(bad)).toThrow(/public key/i);
});
