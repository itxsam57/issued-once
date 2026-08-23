import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { verifyFourthwallWebhookSignature } from '@/server/webhooks/FourthwallWebhookSignature';

const secret = 'webhook-secret';
const raw = Buffer.from('{"id":"evt-1"}', 'utf8');
const valid = createHmac('sha256', secret).update(raw).digest('base64');

describe('verifyFourthwallWebhookSignature', () => {
  test('accepts the exact raw body', () => {
    expect(verifyFourthwallWebhookSignature(raw, valid, secret)).toBe(true);
  });

  test('rejects any body-byte change and malformed signatures', () => {
    expect(
      verifyFourthwallWebhookSignature(Buffer.from('{"id":"evt-2"}', 'utf8'), valid, secret),
    ).toBe(false);
    expect(verifyFourthwallWebhookSignature(raw, 'not-valid-base64***', secret)).toBe(false);
    expect(verifyFourthwallWebhookSignature(raw, '', secret)).toBe(false);
  });
});
