import { beforeAll, expect, test } from 'vitest';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
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
  contact: VerifiedContactRecord | null = null;

  async findRecentChallenge(experienceId: string, emailHash: string) {
    if (
      this.challenge?.experienceId === experienceId &&
      this.challenge.emailHash === emailHash &&
      !this.challenge.consumedAt
    ) return this.challenge;
    return null;
  }

  async createChallenge(record: OtpChallengeRecord) {
    this.challenge = structuredClone(record);
  }

  async findChallenge(challengeId: string) {
    return this.challenge?.id === challengeId ? this.challenge : null;
  }

  async recordFailedAttempt(challengeId: string, attemptsRemaining: number) {
    if (this.challenge?.id === challengeId) this.challenge.attemptsRemaining = attemptsRemaining;
  }

  async verifyContact(input: { challengeId: string; contact: VerifiedContactRecord }) {
    if (this.challenge?.id !== input.challengeId || this.challenge.consumedAt) return false;
    this.challenge.consumedAt = input.contact.verifiedAt;
    this.contact = structuredClone(input.contact);
    return true;
  }

  async findVerifiedByExperienceId(experienceId: string) {
    return this.contact?.experienceId === experienceId ? this.contact : null;
  }
}

class MemoryDelivery implements OtpDeliveryGateway {
  sent: Array<{ email: string; code: string; challengeId: string }> = [];
  async sendOtp(input: { email: string; code: string; challengeId: string }) {
    this.sent.push(input);
    return { providerMessageId: 'mail-1' };
  }
}

const token = 'test-session-token';
const now = new Date('2026-08-19T00:00:00.000Z');

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
  process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

function createService() {
  const experience: ExperienceRecord = {
    id: 'exp-1',
    publicSessionHash: hashSessionToken(token),
    stage: 'COMMITMENT_READY',
    hookId: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
  };
  const contacts = new MemoryContactRepository();
  const delivery = new MemoryDelivery();
  let clock = now;
  const service = new ContactService(
    new MemoryExperienceRepository(experience),
    contacts,
    delivery,
    () => clock,
    () => '123456',
  );
  return { service, contacts, delivery, advance(ms: number) { clock = new Date(clock.getTime() + ms); } };
}

test('stores only a keyed OTP digest and encrypted contact data, then verifies once', async () => {
  const { service, contacts, delivery } = createService();
  const requested = await service.requestOtp({
    experienceToken: token,
    email: '  Sam@Example.com ',
    ipKey: 'browser-a',
  });

  expect(delivery.sent).toEqual([
    { email: 'sam@example.com', code: '123456', challengeId: requested.challengeId },
  ]);
  expect(JSON.stringify(contacts.challenge)).not.toContain('123456');
  expect(JSON.stringify(contacts.challenge)).not.toContain('sam@example.com');

  const result = await service.verifyOtp({
    experienceToken: token,
    challengeId: requested.challengeId,
    code: '123456',
  });
  expect(result.verified).toBe(true);
  expect(JSON.stringify(contacts.contact)).not.toContain('sam@example.com');
  expect(await decryptPrivatePayload<{ email: string }>(contacts.contact!.encryptedEmail)).toEqual({
    email: 'sam@example.com',
  });

  await expect(service.verifyOtp({
    experienceToken: token,
    challengeId: requested.challengeId,
    code: '123456',
  })).rejects.toThrow(/used|challenge/i);
});

test('enforces resend cooldown, expiry, and a bounded wrong-code attempt budget', async () => {
  const { service } = createService();
  const requested = await service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  });

  await expect(service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  })).rejects.toThrow(/wait|resend/i);

  for (let i = 0; i < 5; i += 1) {
    await expect(service.verifyOtp({
      experienceToken: token,
      challengeId: requested.challengeId,
      code: '000000',
    })).rejects.toThrow(/code|attempt/i);
  }
  await expect(service.verifyOtp({
    experienceToken: token,
    challengeId: requested.challengeId,
    code: '123456',
  })).rejects.toThrow(/attempt|locked/i);

  const second = createService();
  const expiring = await second.service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  });
  second.advance(10 * 60 * 1000 + 1);
  await expect(second.service.verifyOtp({
    experienceToken: token,
    challengeId: expiring.challengeId,
    code: '123456',
  })).rejects.toThrow(/expired/i);
});
