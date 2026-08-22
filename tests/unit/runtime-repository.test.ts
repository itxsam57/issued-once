import { afterEach, describe, expect, test, vi } from 'vitest';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PersistentExperienceRepositoryUnavailableError } from '@/server/experience/runtimeRepository';

const originalPreview = process.env.ENABLE_VISUAL_PREVIEW;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalPreview === undefined) delete process.env.ENABLE_VISUAL_PREVIEW;
  else process.env.ENABLE_VISUAL_PREVIEW = originalPreview;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('getExperienceRepository', () => {
  test('preview mode remains explicitly isolated from production storage', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://should-not-be-used.example/db');
    const { getExperienceRepository } = await import('@/server/experience/runtimeRepository');

    const repository = getExperienceRepository();
    expect(repository.constructor.name).toBe('PreviewExperienceRepository');
  });

  test('DATABASE_URL selects the durable Postgres repository outside preview mode', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@example.com/db');
    const { getExperienceRepository } = await import('@/server/experience/runtimeRepository');

    expect(getExperienceRepository()).toBeInstanceOf(PostgresExperienceRepository);
  });

  test('normal runtime still fails closed without durable storage', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    delete process.env.DATABASE_URL;
    const { getExperienceRepository } = await import('@/server/experience/runtimeRepository');

    expect(() => getExperienceRepository()).toThrow(PersistentExperienceRepositoryUnavailableError);
  });
});
