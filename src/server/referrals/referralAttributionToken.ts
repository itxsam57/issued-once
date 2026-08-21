import { createHmac, timingSafeEqual } from 'node:crypto';

type ReferralAttributionTokenPayload = {
  a: string;
  e: number;
};

function keyBytes(signingKey: string): Buffer {
  const bytes = Buffer.from(signingKey, 'base64');
  if (bytes.length < 32) throw new Error('Referral attribution signing key is invalid');
  return bytes;
}

function signature(payload: string, signingKey: string): string {
  return createHmac('sha256', keyBytes(signingKey)).update(payload, 'utf8').digest('base64url');
}

export function createReferralAttributionToken(
  input: { attributionId: string; expiresAt: Date },
  signingKey: string,
): string {
  if (!input.attributionId.trim()) throw new Error('Referral attribution id is required');
  if (!Number.isFinite(input.expiresAt.getTime())) throw new Error('Referral attribution expiry is invalid');

  const payload: ReferralAttributionTokenPayload = {
    a: input.attributionId,
    e: input.expiresAt.getTime(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signature(encoded, signingKey)}`;
}

export function verifyReferralAttributionToken(
  token: string,
  signingKey: string,
  now: Date = new Date(),
): { attributionId: string; expiresAt: Date } | null {
  try {
    const [encoded, suppliedSignature, extra] = token.split('.');
    if (!encoded || !suppliedSignature || extra !== undefined) return null;

    const expectedSignature = signature(encoded, signingKey);
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<ReferralAttributionTokenPayload>;
    if (typeof parsed.a !== 'string' || !parsed.a.trim() || !Number.isSafeInteger(parsed.e)) return null;

    const expiresAt = new Date(parsed.e);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return null;
    return { attributionId: parsed.a, expiresAt };
  } catch {
    return null;
  }
}
