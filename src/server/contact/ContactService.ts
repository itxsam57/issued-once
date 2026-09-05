import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { encryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import { verifyContactContinuityToken } from './contactContinuity';
import type {
  ContactRepository,
  OtpChallengeRecord,
  OtpRateLimitReservation,
  OtpRateLimitSubject,
  VerifiedContactRecord,
} from './ContactRepository';
import type { OtpDeliveryGateway } from './OtpDeliveryGateway';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_ATTEMPTS = 5;
const RATE_SHORT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LONG_WINDOW_MS = 24 * 60 * 60 * 1000;

const OTP_RATE_LIMITS: Record<OtpRateLimitSubject, { short: number; long: number }> = {
  email: { short: 3, long: 10 },
  experience: { short: 5, long: 20 },
  ip: { short: 60, long: 500 },
};

export type OtpVerificationErrorCode =
  | 'WRONG_CODE'
  | 'ATTEMPT_LIMIT'
  | 'EXPIRED'
  | 'USED_OR_STALE'
  | 'CHALLENGE_NOT_FOUND';

export class OtpVerificationError extends Error {
  constructor(
    message = 'OTP verification failed',
    readonly code: OtpVerificationErrorCode,
    readonly attemptsRemaining?: number,
  ) {
    super(message);
    this.name = 'OtpVerificationError';
  }
}

export function otpRequestTag(challengeId: string): string {
  return challengeId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

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

  private rateReservation(
    subjectKind: OtpRateLimitSubject,
    subjectHash: string,
    now: Date,
  ): OtpRateLimitReservation {
    const limits = OTP_RATE_LIMITS[subjectKind];
    return {
      subjectKind,
      subjectHash,
      now,
      shortWindowCutoff: new Date(now.getTime() - RATE_SHORT_WINDOW_MS),
      longWindowCutoff: new Date(now.getTime() - RATE_LONG_WINDOW_MS),
      shortLimit: limits.short,
      longLimit: limits.long,
    };
  }

  async checkContinuity(input: {
    experienceToken: string;
    email: string;
    continuityToken?: string;
  }): Promise<{ alreadyVerified: boolean }> {
    const experience = await this.requireExperience(input.experienceToken);
    if (!input.continuityToken) return { alreadyVerified: false };

    let continuity;
    try {
      continuity = verifyContactContinuityToken(
        input.continuityToken,
        experience.publicSessionHash,
        this.now(),
      );
    } catch {
      return { alreadyVerified: false };
    }

    return {
      alreadyVerified: safeHexEqual(
        continuity.emailHash,
        emailLookupHash(input.email),
      ),
    };
  }

  async reuseVerified(input: {
    experienceToken: string;
    email: string;
    continuityToken?: string;
  }): Promise<{ verified: true }> {
    const experience = await this.requireExperience(input.experienceToken);
    if (!input.continuityToken) {
      throw new Error('Verified email reuse is not available');
    }

    let continuity;
    try {
      continuity = verifyContactContinuityToken(
        input.continuityToken,
        experience.publicSessionHash,
        this.now(),
      );
    } catch {
      throw new Error('Verified email reuse is not available');
    }

    const expectedEmailHash = emailLookupHash(input.email);
    if (!safeHexEqual(continuity.emailHash, expectedEmailHash)) {
      throw new Error('Verified email reuse is not available');
    }

    const copied = await this.contacts.copyVerifiedContact({
      sourceContactId: continuity.sourceContactId,
      targetExperienceId: experience.id,
      expectedEmailHash,
      newContactId: randomUUID(),
      now: this.now(),
    });
    if (!copied) throw new Error('Verified email reuse is not available');

    return { verified: true };
  }

  async requestOtp(input: {
    experienceToken: string;
    email: string;
    ipKey: string;
  }): Promise<{ challengeId: string; retryAfterSeconds: number; requestTag: string }> {
    const experience = await this.requireExperience(input.experienceToken);
    return this.requestOtpForExperience({
      experienceId: experience.id,
      email: input.email,
      ipKey: input.ipKey,
    });
  }

  async requestOtpForExperience(input: {
    experienceId: string;
    email: string;
    ipKey: string;
  }): Promise<{ challengeId: string; retryAfterSeconds: number; requestTag: string }> {
    const experienceId = input.experienceId.trim();
    if (!experienceId) throw new Error('Experience id is required');

    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@') || email.length > 320) {
      throw new Error('Email is invalid');
    }

    const emailHash = emailLookupHash(email);
    const current = await this.contacts.findRecentChallenge(experienceId, emailHash);
    const now = this.now();
    if (current && current.resendAvailableAt.getTime() > now.getTime()) {
      const seconds = Math.ceil((current.resendAvailableAt.getTime() - now.getTime()) / 1000);
      throw new Error(`Wait ${seconds} seconds before requesting another code`);
    }

    const ipKey = input.ipKey.trim() || 'unknown';
    const ipHash = privacyLookupHash('ip', ipKey);
    const reservations: OtpRateLimitReservation[] = [
      this.rateReservation('email', emailHash, now),
      this.rateReservation('experience', privacyLookupHash('experience', experienceId), now),
    ];
    if (ipKey !== 'unknown') {
      reservations.push(this.rateReservation('ip', ipHash, now));
    }

    const allowed = await Promise.all(
      reservations.map((reservation) => this.contacts.reserveOtpRateLimit(reservation)),
    );
    if (allowed.some((value) => !value)) {
      throw new Error('OTP request rate limit reached; wait before requesting another code');
    }

    const challengeId = randomUUID();
    const code = this.generateCode();
    if (!/^\d{6}$/.test(code)) throw new Error('OTP generator returned an invalid code');

    const record: OtpChallengeRecord = {
      id: challengeId,
      experienceId,
      emailHash,
      encryptedEmail: await encryptPrivatePayload({ email }),
      ipHash,
      codeHash: keyedDigest(`otp:${challengeId}:${emailHash}:${code}`),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      attemptsRemaining: OTP_ATTEMPTS,
      consumedAt: null,
      createdAt: now,
    };

    await this.contacts.createChallenge(record);
    await this.delivery.sendOtp({ email, code, challengeId });

    return {
      challengeId,
      retryAfterSeconds: RESEND_COOLDOWN_MS / 1000,
      requestTag: otpRequestTag(challengeId),
    };
  }

  async verifyOtp(input: {
    experienceToken: string;
    challengeId: string;
    code: string;
  }): Promise<{ verified: true }> {
    const experience = await this.requireExperience(input.experienceToken);
    return this.verifyOtpForExperience({
      experienceId: experience.id,
      challengeId: input.challengeId,
      code: input.code,
    });
  }

  async verifyOtpForExperience(input: {
    experienceId: string;
    challengeId: string;
    code: string;
  }): Promise<{ verified: true }> {
    const experienceId = input.experienceId.trim();
    if (!experienceId) {
      throw new OtpVerificationError('OTP challenge not found', 'CHALLENGE_NOT_FOUND');
    }

    const challenge = await this.contacts.findChallenge(input.challengeId);
    if (!challenge || challenge.experienceId !== experienceId) {
      throw new OtpVerificationError(
        'OTP challenge not found',
        'CHALLENGE_NOT_FOUND',
      );
    }
    if (challenge.consumedAt) {
      throw new OtpVerificationError(
        'OTP challenge has already been used',
        'USED_OR_STALE',
      );
    }

    const now = this.now();
    if (challenge.expiresAt.getTime() < now.getTime()) {
      throw new OtpVerificationError('OTP challenge expired', 'EXPIRED');
    }
    if (challenge.attemptsRemaining <= 0) {
      throw new OtpVerificationError(
        'OTP attempt limit reached',
        'ATTEMPT_LIMIT',
        0,
      );
    }
    if (!/^\d{6}$/.test(input.code)) {
      throw new OtpVerificationError(
        'OTP code is invalid',
        'WRONG_CODE',
        challenge.attemptsRemaining,
      );
    }

    const candidate = keyedDigest(
      `otp:${challenge.id}:${challenge.emailHash}:${input.code}`,
    );
    if (!safeHexEqual(candidate, challenge.codeHash)) {
      const remaining = Math.max(0, challenge.attemptsRemaining - 1);
      await this.contacts.recordFailedAttempt(challenge.id, remaining);
      if (remaining === 0) {
        throw new OtpVerificationError(
          'OTP attempt limit reached',
          'ATTEMPT_LIMIT',
          0,
        );
      }
      throw new OtpVerificationError(
        'OTP code is invalid',
        'WRONG_CODE',
        remaining,
      );
    }

    const contact: VerifiedContactRecord = {
      id: randomUUID(),
      experienceId,
      emailHash: challenge.emailHash,
      encryptedEmail: challenge.encryptedEmail,
      verifiedAt: now,
    };
    const verified = await this.contacts.verifyContact({ challengeId: challenge.id, contact });
    if (!verified) {
      throw new OtpVerificationError(
        'OTP challenge is no longer active',
        'USED_OR_STALE',
      );
    }

    return { verified: true };
  }
}
