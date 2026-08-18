import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type {
  ContactRepository,
  OtpChallengeRecord,
  VerifiedContactRecord,
} from './ContactRepository';
import type { OtpDeliveryGateway } from './OtpDeliveryGateway';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_ATTEMPTS = 5;

function loadIdentityKey(): Buffer {
  const encoded = process.env.IDENTITY_HMAC_KEY;
  if (!encoded) throw new Error('IDENTITY_HMAC_KEY is required');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('IDENTITY_HMAC_KEY must decode to exactly 32 bytes');
  }
  return key;
}

function keyedDigest(value: string): string {
  return createHmac('sha256', loadIdentityKey()).update(value, 'utf8').digest('hex');
}

function safeHexEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailLookupHash(email: string): string {
  return keyedDigest(`email:${normalizeEmail(email)}`);
}

export function privacyLookupHash(namespace: string, value: string): string {
  return keyedDigest(`${namespace}:${value}`);
}

export class ContactService {
  constructor(
    private readonly experiences: ExperienceRepository,
    private readonly contacts: ContactRepository,
    private readonly delivery: OtpDeliveryGateway,
    private readonly now: () => Date = () => new Date(),
    private readonly generateCode: () => string = () => randomInt(0, 1_000_000).toString().padStart(6, '0'),
  ) {}

  private async requireExperience(token: string) {
    const experience = await this.experiences.findBySessionHash(hashSessionToken(token));
    if (!experience) throw new Error('Experience not found');
    return experience;
  }

  async requestOtp(input: {
    experienceToken: string;
    email: string;
    ipKey: string;
  }): Promise<{ challengeId: string; retryAfterSeconds: number }> {
    const experience = await this.requireExperience(input.experienceToken);
    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@') || email.length > 320) {
      throw new Error('Email is invalid');
    }

    const emailHash = emailLookupHash(email);
    const current = await this.contacts.findRecentChallenge(experience.id, emailHash);
    const now = this.now();
    if (current && current.resendAvailableAt.getTime() > now.getTime()) {
      const seconds = Math.ceil((current.resendAvailableAt.getTime() - now.getTime()) / 1000);
      throw new Error(`Wait ${seconds} seconds before requesting another code`);
    }

    const challengeId = randomUUID();
    const code = this.generateCode();
    if (!/^\d{6}$/.test(code)) throw new Error('OTP generator returned an invalid code');

    const record: OtpChallengeRecord = {
      id: challengeId,
      experienceId: experience.id,
      emailHash,
      encryptedEmail: await encryptPrivatePayload({ email }),
      ipHash: privacyLookupHash('ip', input.ipKey || 'unknown'),
      codeHash: keyedDigest(`otp:${challengeId}:${emailHash}:${code}`),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      attemptsRemaining: OTP_ATTEMPTS,
      consumedAt: null,
      createdAt: now,
    };

    await this.contacts.createChallenge(record);
    await this.delivery.sendOtp({ email, code, challengeId });

    return { challengeId, retryAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
  }

  async verifyOtp(input: {
    experienceToken: string;
    challengeId: string;
    code: string;
  }): Promise<{ verified: true }> {
    const experience = await this.requireExperience(input.experienceToken);
    const challenge = await this.contacts.findChallenge(input.challengeId);
    if (!challenge || challenge.experienceId !== experience.id) {
      throw new Error('OTP challenge not found');
    }
    if (challenge.consumedAt) throw new Error('OTP challenge has already been used');

    const now = this.now();
    if (challenge.expiresAt.getTime() < now.getTime()) throw new Error('OTP challenge expired');
    if (challenge.attemptsRemaining <= 0) throw new Error('OTP attempt limit reached');
    if (!/^\d{6}$/.test(input.code)) throw new Error('OTP code is invalid');

    const candidate = keyedDigest(
      `otp:${challenge.id}:${challenge.emailHash}:${input.code}`,
    );
    if (!safeHexEqual(candidate, challenge.codeHash)) {
      const remaining = Math.max(0, challenge.attemptsRemaining - 1);
      await this.contacts.recordFailedAttempt(challenge.id, remaining);
      throw new Error(remaining === 0 ? 'OTP attempt limit reached' : 'OTP code is invalid');
    }

    const contact: VerifiedContactRecord = {
      id: randomUUID(),
      experienceId: experience.id,
      emailHash: challenge.emailHash,
      encryptedEmail: challenge.encryptedEmail,
      verifiedAt: now,
    };
    const verified = await this.contacts.verifyContact({ challengeId: challenge.id, contact });
    if (!verified) throw new Error('OTP challenge could not be verified');

    return { verified: true };
  }
}
