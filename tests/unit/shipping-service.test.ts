import { beforeAll, expect, test } from 'vitest';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
} from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type {
  ContactRepository,
  OtpChallengeRecord,
  VerifiedContactRecord,
} from '@/server/contact/ContactRepository';
import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import { ShippingService } from '@/server/shipping/ShippingService';
import type { ShippingRepository, ShippingSnapshotRecord } from '@/server/shipping/ShippingRepository';

const token = 'shipping-session';
const now = new Date('2026-08-19T00:00:00.000Z');

class MemoryExperienceRepository implements ExperienceRepository {
  constructor(private readonly record: ExperienceRecord) {}
  async create(_record: ExperienceRecord) {}
  async findBySessionHash(hash: string) {
    return hash === this.record.publicSessionHash ? this.record : null;
  }
  async saveAnswerAndAdvance(_transition: AnswerTransition) {}
}

class MemoryContactRepository implements ContactRepository {
  constructor(public contact: VerifiedContactRecord | null) {}
  async findRecentChallenge(_experienceId: string, _emailHash: string) { return null; }
  async createChallenge(_record: OtpChallengeRecord) {}
  async findChallenge(_challengeId: string) { return null; }
  async recordFailedAttempt(_challengeId: string, _attemptsRemaining: number) {}
  async verifyContact(_input: { challengeId: string; contact: VerifiedContactRecord }) { return false; }
  async findVerifiedByExperienceId(experienceId: string) {
    return this.contact?.experienceId === experienceId ? this.contact : null;
  }
  async copyVerifiedContact() { return false; }
}

class MemoryShippingRepository implements ShippingRepository {
  record: ShippingSnapshotRecord | null = null;
  async upsert(record: ShippingSnapshotRecord) {
    this.record = structuredClone(record);
    return record;
  }
  async findByExperienceId(experienceId: string) {
    return this.record?.experienceId === experienceId ? this.record : null;
  }
}

beforeAll(() => {
  process.env.QUIZ_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 9).toString('base64');
});

const encryptedStub: EncryptedPayload = {
  version: 1,
  keyVersion: 'v1',
  iv: 'stub',
  tag: 'stub',
  ciphertext: 'stub',
};

function experience(stage: ExperienceRecord['stage'] = 'COMMITMENT_READY'): ExperienceRecord {
  return {
    id: 'exp-ship',
    publicSessionHash: hashSessionToken(token),
    stage,
    hookId: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
  };
}

function verifiedContact(): VerifiedContactRecord {
  return {
    id: 'contact-1',
    experienceId: 'exp-ship',
    emailHash: 'a'.repeat(64),
    encryptedEmail: encryptedStub,
    verifiedAt: now,
  };
}

function validAddress() {
  return {
    recipientName: 'Sam Example',
    line1: '1 Quiet Street',
    line2: '',
    city: 'London',
    region: 'Greater London',
    postalCode: 'SW1A 1AA',
    countryCode: 'GB',
    phone: '+44 7000 000000',
  };
}

test('refuses shipping until the experience has a verified contact', async () => {
  const service = new ShippingService(
    new MemoryExperienceRepository(experience()),
    new MemoryContactRepository(null),
    new MemoryShippingRepository(),
    () => now,
  );

  await expect(service.save({
    experienceToken: token,
    address: validAddress(),
  })).rejects.toThrow(/verified contact/i);
});

test('requires province or state and courier phone at the server boundary', async () => {
  const service = new ShippingService(
    new MemoryExperienceRepository(experience()),
    new MemoryContactRepository(verifiedContact()),
    new MemoryShippingRepository(),
    () => now,
  );

  await expect(service.save({
    experienceToken: token,
    address: { ...validAddress(), region: '   ' },
  })).rejects.toThrow(/shipping address is incomplete/i);

  await expect(service.save({
    experienceToken: token,
    address: { ...validAddress(), phone: '   ' },
  })).rejects.toThrow(/shipping address is incomplete/i);
});

test('stores the full shipping address only inside encrypted payload', async () => {
  const shipping = new MemoryShippingRepository();
  const service = new ShippingService(
    new MemoryExperienceRepository(experience()),
    new MemoryContactRepository(verifiedContact()),
    shipping,
    () => now,
  );

  await service.save({
    experienceToken: token,
    address: {
      ...validAddress(),
      line2: 'Flat 7',
      countryCode: 'gb',
    },
  });

  expect(shipping.record?.countryCode).toBe('GB');
  expect(JSON.stringify(shipping.record)).not.toContain('Quiet Street');
  expect(JSON.stringify(shipping.record)).not.toContain('SW1A 1AA');
  expect(await decryptPrivatePayload(shipping.record!.encryptedAddress)).toEqual({
    recipientName: 'Sam Example',
    line1: '1 Quiet Street',
    line2: 'Flat 7',
    city: 'London',
    region: 'Greater London',
    postalCode: 'SW1A 1AA',
    countryCode: 'GB',
    phone: '+44 7000 000000',
  });
});

test('blocks shipping mutation after checkout has started', async () => {
  const service = new ShippingService(
    new MemoryExperienceRepository(experience('CHECKOUT_STARTED')),
    new MemoryContactRepository(verifiedContact()),
    new MemoryShippingRepository(),
    () => now,
  );

  await expect(service.save({
    experienceToken: token,
    address: {
      ...validAddress(),
      line1: 'Changed after payment',
    },
  })).rejects.toThrow(/locked|checkout/i);
});
