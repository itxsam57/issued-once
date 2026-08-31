import { describe, expect, test } from 'vitest';
import type {
  AnswerTransition,
  ExperienceRecord,
  ExperienceRepository,
} from '@/server/experience/ExperienceRepository';
import { ExperienceAccessService } from '@/server/experience/ExperienceAccessService';
import { hashSessionToken } from '@/server/http/sessionToken';

const now = new Date('2026-08-31T16:00:00.000Z');
const oldToken = 'old-browser-session-token';
const newToken = 'new-browser-session-token';

class MemoryExperienceRepository implements ExperienceRepository {
  private readonly records = new Map<string, ExperienceRecord>();

  constructor(record: ExperienceRecord) {
    this.records.set(record.publicSessionHash, structuredClone(record));
  }

  async create(record: ExperienceRecord) {
    this.records.set(record.publicSessionHash, structuredClone(record));
  }

  async findBySessionHash(publicSessionHash: string) {
    const record = this.records.get(publicSessionHash);
    return record ? structuredClone(record) : null;
  }

  async saveAnswerAndAdvance(_transition: AnswerTransition) {}

  async rotateSessionHash(input: {
    experienceId: string;
    publicSessionHash: string;
    updatedAt: Date;
  }) {
    const entry = [...this.records.entries()].find(([, record]) => record.id === input.experienceId);
    if (!entry) return false;
    const [oldHash, record] = entry;
    this.records.delete(oldHash);
    this.records.set(input.publicSessionHash, {
      ...record,
      publicSessionHash: input.publicSessionHash,
      updatedAt: input.updatedAt,
    });
    return true;
  }

  async rotateSessionHashIfCurrent(input: {
    experienceId: string;
    expectedPublicSessionHash: string;
    publicSessionHash: string;
    updatedAt: Date;
  }) {
    const record = this.records.get(input.expectedPublicSessionHash);
    if (!record || record.id !== input.experienceId) return false;
    this.records.delete(input.expectedPublicSessionHash);
    this.records.set(input.publicSessionHash, {
      ...record,
      publicSessionHash: input.publicSessionHash,
      updatedAt: input.updatedAt,
    });
    return true;
  }
}

function record(): ExperienceRecord {
  return {
    id: 'exp-access-1',
    publicSessionHash: hashSessionToken(oldToken),
    stage: 'COMMITMENT_READY',
    hookId: null,
    createdAt: new Date('2026-08-31T15:00:00.000Z'),
    updatedAt: new Date('2026-08-31T15:00:00.000Z'),
    expiresAt: new Date('2026-09-01T15:00:00.000Z'),
  };
}

describe('ExperienceAccessService', () => {
  test('rotates a known experience onto a fresh existing-session credential', async () => {
    const repository = new MemoryExperienceRepository(record());
    const service = new ExperienceAccessService(repository, () => newToken, () => now);

    const restored = await service.restore('exp-access-1');

    expect(restored).toEqual({ token: newToken });
    expect(await repository.findBySessionHash(hashSessionToken(oldToken))).toBeNull();
    expect(await repository.findBySessionHash(hashSessionToken(newToken))).toMatchObject({
      id: 'exp-access-1',
      updatedAt: now,
    });
  });

  test('fails closed when the target experience cannot be rotated', async () => {
    const repository = new MemoryExperienceRepository(record());
    const service = new ExperienceAccessService(repository, () => newToken, () => now);

    await expect(service.restore('missing-experience')).rejects.toThrow('Experience access could not be restored');
  });

  test('compare-and-swaps a paid return only from the browser current session', async () => {
    const repository = new MemoryExperienceRepository(record());
    const service = new ExperienceAccessService(repository, () => newToken, () => now);

    await expect(service.restoreFromCurrent('exp-access-1', oldToken)).resolves.toEqual({ token: newToken });
    expect(await repository.findBySessionHash(hashSessionToken(oldToken))).toBeNull();
    expect(await repository.findBySessionHash(hashSessionToken(newToken))).toMatchObject({
      id: 'exp-access-1',
      updatedAt: now,
    });
  });

  test('rejects a stale or foreign browser session without rotating the Issue credential', async () => {
    const repository = new MemoryExperienceRepository(record());
    const service = new ExperienceAccessService(repository, () => newToken, () => now);

    await expect(service.restoreFromCurrent('exp-access-1', 'stale-or-foreign-token'))
      .rejects.toThrow('Experience access could not be restored');

    expect(await repository.findBySessionHash(hashSessionToken(oldToken))).toMatchObject({ id: 'exp-access-1' });
    expect(await repository.findBySessionHash(hashSessionToken(newToken))).toBeNull();
  });
});
