import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresOpsRepository } from './PostgresOpsRepository';

export class OpsRuntimeUnavailableError extends Error {
  constructor(message = 'Owner operations runtime is not configured') {
    super(message);
    this.name = 'OpsRuntimeUnavailableError';
  }
}

export function createOpsRepository() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new OpsRuntimeUnavailableError('DATABASE_URL is required');
  return new PostgresOpsRepository(createNeonSqlExecutor(databaseUrl));
}
