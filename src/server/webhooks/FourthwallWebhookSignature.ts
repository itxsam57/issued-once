import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyFourthwallWebhookSignature(
  rawBody: Uint8Array,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const provided = Buffer.from(signature, 'base64');

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
