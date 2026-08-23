import { beforeAll, describe, expect, it } from 'vitest';
import { ContactService } from '@/server/contact/ContactService';
import type {
  ContactRepository,
  OtpChallengeRecord,
  VerifiedContactRecord,
} from '@/server/contact/ContactRepository';
import type { OtpDeliveryGateway } from '@/server/contact/OtpDeliveryGateway';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
} from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';

const token = 'otp-recovery-session';
const start = new Date('2026-08-23T07:00:00.000Z');

class MemoryExperienceRepository implements ExperienceRepository {
  constructor(private readonly record: ExperienceRecord) {}
  async create(_record: ExperienceRecord) {}
  async findBySessionHash(hash: string) {
    return hash === this.record.publicSessionHash ? this.record : null;
  }
  async saveAnswerAndAdvance(_transition: AnswerTransition) {}
}

class MemoryContactRepository implements ContactRepository {
  challenge: OtpChallengeRecord | null = null;

  async findRecentChallenge(experienceId: string, emailHash: string) {
    return this.challenge?.experienceId === experienceId &&
      this.challenge.emailHash === emailHash &&
      !this.challenge.consumedAt
      ? this.challenge
      : null;
  }
  async createChallenge(record: OtpChallengeRecord) { this.challenge = structuredClone(record); }
  async findChallenge(id: string) { return this.challenge?.id === id ? this.challenge : null; }
  async recordFailedAttempt(id: string, attemptsRemaining: number) {
    if (this.challenge?.id === id) this.challenge.attemptsRemaining = attemptsRemaining;
  }
  async verifyContact(input: { challengeId: string; contact: VerifiedContactRecord }) {
    if (this.challenge?.id !== input.challengeId || this.challenge.consumedAt) return false;
    this.challenge.consumedAt = input.contact.verifiedAt;
    return true;
  }
  async findVerifiedByExperienceId() { return null; }
  async copyVerifiedContact() { return false; }
}

class MemoryDelivery implements OtpDeliveryGateway {
  async sendOtp() { return { providerMessageId: 'mail-otp-recovery' }; }
}

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
  process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

function harness() {
  const experience: ExperienceRecord = {
    id: 'exp-otp-recovery',
    publicSessionHash: hashSessionToken(token),
    stage: 'COMMITMENT_READY',
    hookId: null,
    createdAt: start,
    updatedAt: start,
    expiresAt: new Date(start.getTime() + 86_400_000),
  };
  const contacts = new MemoryContactRepository();
  let clock = start;
  const service = new ContactService(
    new MemoryExperienceRepository(experience),
    contacts,
    new MemoryDelivery(),
    () => clock,
    () => '123456',
  );
  return {
    service,
    contacts,
    advance(ms: number) { clock = new Date(clock.getTime() + ms); },
  };
}

async function request(service: ContactService) {
  return service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  });
}

describe('OTP recovery contract', () => {
  it('returns a stable public request tag derived from the active challenge id', async () => {
    const { service } = harness();
    const result = await request(service);
    expect(result).toHaveProperty(
      'requestTag',
      result.challengeId.replace(/-/g, '').slice(0, 8).toUpperCase(),
    );
  });

  it('reports remaining attempts for a wrong code and locks on the fifth failure', async () => {
    const { service } = harness();
    const active = await request(service);

    await expect(service.verifyOtp({
      experienceToken: token,
      challengeId: active.challengeId,
      code: '000000',
    })).rejects.toMatchObject({ code: 'WRONG_CODE', attemptsRemaining: 4 });

    for (let remaining = 3; remaining >= 1; remaining -= 1) {
      await expect(service.verifyOtp({
        experienceToken: token,
        challengeId: active.challengeId,
        code: '000000',
      })).rejects.toMatchObject({ code: 'WRONG_CODE', attemptsRemaining: remaining });
    }

    await expect(service.verifyOtp({
      experienceToken: token,
      challengeId: active.challengeId,
      code: '000000',
    })).rejects.toMatchObject({ code: 'ATTEMPT_LIMIT', attemptsRemaining: 0 });
  });

  it('distinguishes expired, used/stale and missing challenges', async () => {
    const expired = harness();
    const expiredRequest = await request(expired.service);
    expired.advance(10 * 60 * 1000 + 1);
    await expect(expired.service.verifyOtp({
      experienceToken: token,
      challengeId: expiredRequest.challengeId,
      code: '123456',
    })).rejects.toMatchObject({ code: 'EXPIRED' });

    const used = harness();
    const usedRequest = await request(used.service);
    used.contacts.challenge!.consumedAt = start;
    await expect(used.service.verifyOtp({
      experienceToken: token,
      challengeId: usedRequest.challengeId,
      code: '123456',
    })).rejects.toMatchObject({ code: 'USED_OR_STALE' });

    const missing = harness();
    await expect(missing.service.verifyOtp({
      experienceToken: token,
      challengeId: 'missing-challenge',
      code: '123456',
    })).rejects.toMatchObject({ code: 'CHALLENGE_NOT_FOUND' });
  });
});
