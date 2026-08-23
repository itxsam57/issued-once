import { beforeAll, describe, expect, it } from 'vitest';
import {
  createContactContinuityToken,
  verifyContactContinuityToken,
} from '@/server/contact/contactContinuity';

beforeAll(() => {
  process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('contact continuity proof', () => {
  const input = {
    sourceContactId: 'contact-1',
    emailHash: 'a'.repeat(64),
    childSessionHash: 'b'.repeat(64),
    issuedAt: new Date('2026-08-23T06:00:00.000Z'),
  };

  it('round-trips only for the child session it was issued to', () => {
    const token = createContactContinuityToken(input);

    expect(verifyContactContinuityToken(token, input.childSessionHash)).toEqual({
      sourceContactId: input.sourceContactId,
      emailHash: input.emailHash,
      childSessionHash: input.childSessionHash,
      issuedAt: input.issuedAt.toISOString(),
    });

    expect(() => verifyContactContinuityToken(token, 'c'.repeat(64))).toThrow(/session/i);
  });

  it('rejects a tampered payload', () => {
    const token = createContactContinuityToken(input);
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new Error('fixture token is malformed');

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, string>;
    decoded.emailHash = 'f'.repeat(64);
    const tamperedPayload = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');

    expect(() => verifyContactContinuityToken(`${tamperedPayload}.${signature}`, input.childSessionHash)).toThrow(/signature|continuity/i);
  });

  it('rejects a tampered signature', () => {
    const token = createContactContinuityToken(input);
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new Error('fixture token is malformed');
    const replacement = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

    expect(() => verifyContactContinuityToken(`${payload}.${replacement}`, input.childSessionHash)).toThrow(/signature|continuity/i);
  });

  it('rejects malformed hashes and contact ids at creation time', () => {
    expect(() => createContactContinuityToken({ ...input, emailHash: 'short' })).toThrow(/email/i);
    expect(() => createContactContinuityToken({ ...input, childSessionHash: 'short' })).toThrow(/session/i);
    expect(() => createContactContinuityToken({ ...input, sourceContactId: '' })).toThrow(/contact/i);
  });
});
