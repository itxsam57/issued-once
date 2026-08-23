import { createHmac, timingSafeEqual } from 'node:crypto';

const DOMAIN = 'issued-once:contact-continuity:v1';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

type ContactContinuityInput = {
  sourceContactId: string;
  emailHash: string;
  childSessionHash: string;
  issuedAt: Date;
};

export type ContactContinuityPayload = {
  sourceContactId: string;
  emailHash: string;
  childSessionHash: string;
  issuedAt: string;
};

function identityKey(): Buffer {
  const encoded = process.env.IDENTITY_HMAC_KEY;
  if (!encoded) throw new Error('IDENTITY_HMAC_KEY is required');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('IDENTITY_HMAC_KEY must decode to exactly 32 bytes');
  return key;
}

function validatePayload(payload: ContactContinuityPayload): ContactContinuityPayload {
  if (!payload.sourceContactId.trim()) throw new Error('Contact continuity contact id is invalid');
  if (!HASH_PATTERN.test(payload.emailHash)) throw new Error('Contact continuity email hash is invalid');
  if (!HASH_PATTERN.test(payload.childSessionHash)) throw new Error('Contact continuity session hash is invalid');
  if (!Number.isFinite(Date.parse(payload.issuedAt))) throw new Error('Contact continuity issue time is invalid');
  return payload;
}

function signature(payloadPart: string): Buffer {
  return createHmac('sha256', identityKey())
    .update(DOMAIN, 'utf8')
    .update('\0', 'utf8')
    .update(payloadPart, 'utf8')
    .digest();
}

export function createContactContinuityToken(input: ContactContinuityInput): string {
  const payload = validatePayload({
    sourceContactId: input.sourceContactId,
    emailHash: input.emailHash,
    childSessionHash: input.childSessionHash,
    issuedAt: input.issuedAt.toISOString(),
  });
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadPart}.${signature(payloadPart).toString('base64url')}`;
}

export function verifyContactContinuityToken(
  token: string,
  expectedChildSessionHash: string,
): ContactContinuityPayload {
  if (!HASH_PATTERN.test(expectedChildSessionHash)) {
    throw new Error('Contact continuity expected session hash is invalid');
  }

  const [payloadPart, signaturePart, extra] = token.split('.');
  if (!payloadPart || !signaturePart || extra !== undefined) {
    throw new Error('Contact continuity token is invalid');
  }

  let supplied: Buffer;
  try {
    supplied = Buffer.from(signaturePart, 'base64url');
  } catch {
    throw new Error('Contact continuity signature is invalid');
  }
  const expected = signature(payloadPart);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('Contact continuity signature is invalid');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Contact continuity payload is invalid');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Contact continuity payload is invalid');
  const value = parsed as Record<string, unknown>;
  const payload = validatePayload({
    sourceContactId: typeof value.sourceContactId === 'string' ? value.sourceContactId : '',
    emailHash: typeof value.emailHash === 'string' ? value.emailHash : '',
    childSessionHash: typeof value.childSessionHash === 'string' ? value.childSessionHash : '',
    issuedAt: typeof value.issuedAt === 'string' ? value.issuedAt : '',
  });

  if (payload.childSessionHash !== expectedChildSessionHash) {
    throw new Error('Contact continuity token belongs to another session');
  }
  return payload;
}
