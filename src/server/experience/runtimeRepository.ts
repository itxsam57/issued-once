import type { ExperienceRepository } from './ExperienceRepository';
import { createNeonSqlExecutor } from './NeonSqlExecutor';
import { PostgresExperienceRepository } from './PostgresExperienceRepository';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';

export class PersistentExperienceRepositoryUnavailableError extends Error {
  constructor() {
    super('Persistent experience repository is not configured');
    this.name = 'PersistentExperienceRepositoryUnavailableError';
  }
}

export function getExperienceRepository(): ExperienceRepository {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new PreviewExperienceRepository();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new PostgresExperienceRepository(createNeonSqlExecutor(databaseUrl));
  }

  throw new PersistentExperienceRepositoryUnavailableError();
}
