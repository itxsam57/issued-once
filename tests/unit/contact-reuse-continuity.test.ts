import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ContactService,
  emailLookupHash,
} from '@/server/contact/ContactService';
import type { ContactRepository } from '@/server/contact/ContactRepository';
import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { createContactContinuityToken } from '@/server/contact/contactContinuity';
import type { ExperienceRecord, ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';

const token = 'repeat-child-session';
const now = new Date('2026-08-23T06:45:00.000Z');
const experience: ExperienceRecord = {
  id: 'child-exp',
  publicSessionHash: hashSessionToken(token),
  stage: 'COMMITMENT_READY',
  hookId: 'repeat:fresh',
  createdAt: now,
  updatedAt: now,
  expiresAt: new Date(now.getTime() + 86_400_000),
};

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
  process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

function experienceRepository(): ExperienceRepository {
  return {
    create: vi.fn(),
    findBySessionHash: vi.fn(async (hash: string) => hash === experience.publicSessionHash ? experience : null),
    saveAnswerAndAdvance: vi.fn(),
  };
}

function contactHarness(copyResult = true) {
  const copyVerifiedContact = vi.fn().mockResolvedValue(copyResult);
  const contacts = {
    findRecentChallenge: vi.fn(), createChallenge: vi.fn(), findChallenge: vi.fn(), recordFailedAttempt: vi.fn(),
    verifyContact: vi.fn(), findVerifiedByExperienceId: vi.fn(), copyVerifiedContact,
  } as unknown as ContactRepository;
  const delivery = { sendOtp: vi.fn() };
  const service = new ContactService(experienceRepository(), contacts, delivery, () => now, () => '123456');
  const emailHash = emailLookupHash('sam@example.com');
  const continuityToken = createContactContinuityToken({
    sourceContactId: 'source-contact',
    emailHash,
    childSessionHash: experience.publicSessionHash,
    issuedAt: now,
  });
  return { service, copyVerifiedContact, emailHash, continuityToken };
}

describe('verified email reuse continuity', () => {
  it('recognizes only the matching email when continuity is valid for the current child session', async () => {
    const { service, continuityToken } = contactHarness();
    const api = service as ContactService & {
      checkContinuity(input: { experienceToken: string; email: string; continuityToken?: string }): Promise<{ alreadyVerified: boolean }>;
    };

    await expect(api.checkContinuity({ experienceToken: token, email: ' Sam@Example.com ', continuityToken }))
      .resolves.toEqual({ alreadyVerified: true });
    await expect(api.checkContinuity({ experienceToken: token, email: 'other@example.com', continuityToken }))
      .resolves.toEqual({ alreadyVerified: false });
    await expect(api.checkContinuity({ experienceToken: token, email: 'sam@example.com' }))
      .resolves.toEqual({ alreadyVerified: false });
  });

  it('rejects a tampered or different-child proof without revealing verification', async () => {
    const { service, continuityToken, emailHash } = contactHarness();
    const api = service as ContactService & {
      checkContinuity(input: { experienceToken: string; email: string; continuityToken?: string }): Promise<{ alreadyVerified: boolean }>;
    };
    const tampered = `${continuityToken.slice(0, -2)}AA`;
    const otherChild = createContactContinuityToken({
      sourceContactId: 'source-contact', emailHash, childSessionHash: 'b'.repeat(64), issuedAt: now,
    });

    await expect(api.checkContinuity({ experienceToken: token, email: 'sam@example.com', continuityToken: tampered }))
      .resolves.toEqual({ alreadyVerified: false });
    await expect(api.checkContinuity({ experienceToken: token, email: 'sam@example.com', continuityToken: otherChild }))
      .resolves.toEqual({ alreadyVerified: false });
  });

  it('copies encrypted verified contact only after explicit matching-email confirmation', async () => {
    const { service, continuityToken, copyVerifiedContact, emailHash } = contactHarness();
    const api = service as ContactService & {
      reuseVerified(input: { experienceToken: string; email: string; continuityToken?: string }): Promise<{ verified: true }>;
    };

    await expect(api.reuseVerified({ experienceToken: token, email: 'sam@example.com', continuityToken }))
      .resolves.toEqual({ verified: true });
    expect(copyVerifiedContact).toHaveBeenCalledWith(expect.objectContaining({
      sourceContactId: 'source-contact',
      targetExperienceId: experience.id,
      expectedEmailHash: emailHash,
      now,
    }));
  });

  it('fails closed if explicit reuse would overwrite a different verified child contact', async () => {
    const { service, continuityToken } = contactHarness(false);
    const api = service as ContactService & {
      reuseVerified(input: { experienceToken: string; email: string; continuityToken?: string }): Promise<{ verified: true }>;
    };

    await expect(api.reuseVerified({ experienceToken: token, email: 'sam@example.com', continuityToken }))
      .rejects.toThrow(/reuse|verified/i);
  });
});

describe('PostgresContactRepository explicit reuse', () => {
  it('copies only verified contact ciphertext for the expected email and never copies OTP challenges', async () => {
    const sql = { query: vi.fn().mockResolvedValue([{ ok: true }]) };
    const repository = new PostgresContactRepository(sql);
    const api = repository as PostgresContactRepository & {
      copyVerifiedContact(input: {
        sourceContactId: string; targetExperienceId: string; expectedEmailHash: string; newContactId: string; now: Date;
      }): Promise<boolean>;
    };

    await expect(api.copyVerifiedContact({
      sourceContactId: 'source-contact', targetExperienceId: 'child-exp', expectedEmailHash: 'a'.repeat(64),
      newContactId: 'child-contact', now,
    })).resolves.toBe(true);

    const [statement, params] = sql.query.mock.calls[0] as [string, unknown[]];
    expect(statement).toContain('INSERT INTO verified_contacts');
    expect(statement).toContain('FROM verified_contacts');
    expect(statement).toMatch(/email_hash\s*=\s*EXCLUDED\.email_hash/i);
    expect(statement).not.toContain('otp_challenges');
    expect(params).toEqual(expect.arrayContaining(['source-contact', 'child-exp', 'a'.repeat(64), 'child-contact', now]));
  });
});
