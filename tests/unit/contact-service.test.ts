import { beforeAll, expect, test } from 'vitest';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import { ContactService } from '@/server/contact/ContactService';
import type {
  ContactRepository,
  OtpChallengeRecord,
  OtpRateLimitReservation,
  OtpRateLimitSubject,
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
  rateLimitAllowed: Record<OtpRateLimitSubject, boolean> = {
    email: true,
    experience: true,
    ip: true,
  };
  rateLimitReservations: OtpRateLimitReservation[] = [];

  async findRecentChallenge(experienceId: string, emailHash: string) {
    if (
      this.challenge?.experienceId === experienceId &&
      this.challenge.emailHash === emailHash &&
      !this.challenge.consumedAt
    ) return this.challenge;
    return null;
  }

  async reserveOtpRateLimit(input: OtpRateLimitReservation) {
    this.rateLimitReservations.push(structuredClone(input));
    return this.rateLimitAllowed[input.subjectKind];
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

  async copyVerifiedContact() {
    return false;
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
  expect(contacts.rateLimitReservations.map((reservation) => reservation.subjectKind)).toEqual([
    'email',
    'experience',
    'ip',
  ]);
  expect(JSON.stringify(contacts.rateLimitReservations)).not.toContain('sam@example.com');
  expect(JSON.stringify(contacts.rateLimitReservations)).not.toContain('browser-a');

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

test('enforces resend cooldown before consuming another global quota reservation', async () => {
  const { service, contacts } = createService();
  await service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  });
  const reservationsAfterFirstSend = contacts.rateLimitReservations.length;

  await expect(service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  })).rejects.toThrow(/wait|resend/i);

  expect(contacts.rateLimitReservations).toHaveLength(reservationsAfterFirstSend);
});

test('enforces expiry and a bounded wrong-code attempt budget', async () => {
  const { service } = createService();
  const requested = await service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'browser-a',
  });

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

test('blocks cross-experience OTP mail bursts by hashed IP before creating or sending another challenge', async () => {
  const { service, contacts, delivery } = createService();
  contacts.rateLimitAllowed.ip = false;

  await expect(service.requestOtp({
    experienceToken: token,
    email: 'fresh@example.com',
    ipKey: 'shared-source-a',
  })).rejects.toThrow(/wait|resend|rate/i);

  expect(contacts.challenge).toBeNull();
  expect(delivery.sent).toHaveLength(0);
});

test('blocks repeated mail to the same hashed email even when the network quota allows it', async () => {
  const { service, contacts, delivery } = createService();
  contacts.rateLimitAllowed.email = false;

  await expect(service.requestOtp({
    experienceToken: token,
    email: 'victim@example.com',
    ipKey: 'browser-b',
  })).rejects.toThrow(/wait|resend|rate/i);

  expect(contacts.challenge).toBeNull();
  expect(delivery.sent).toHaveLength(0);
});

test('skips the global IP reservation when the proxy cannot identify a client but still enforces email and experience quotas', async () => {
  const { service, contacts, delivery } = createService();
  contacts.rateLimitAllowed.ip = false;

  await service.requestOtp({
    experienceToken: token,
    email: 'sam@example.com',
    ipKey: 'unknown',
  });

  expect(contacts.rateLimitReservations.map((reservation) => reservation.subjectKind)).toEqual([
    'email',
    'experience',
  ]);
  expect(delivery.sent).toHaveLength(1);
});
