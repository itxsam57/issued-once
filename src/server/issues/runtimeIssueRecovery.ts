import { createContactService, ContactRuntimeUnavailableError } from '@/server/contact/runtimeContact';
import { ExperienceAccessService } from '@/server/experience/ExperienceAccessService';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { IssueRecoveryService } from './IssueRecoveryService';
import { PostgresIssueStatusRepository } from './PostgresIssueStatusRepository';

export class IssueRecoveryRuntimeUnavailableError extends Error {
  constructor(message = 'Issue recovery is not configured') {
    super(message);
    this.name = 'IssueRecoveryRuntimeUnavailableError';
  }
}

export function createIssueRecoveryService(): IssueRecoveryService {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new IssueRecoveryRuntimeUnavailableError();

  let contacts;
  try {
    contacts = createContactService();
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      throw new IssueRecoveryRuntimeUnavailableError();
    }
    throw error;
  }

  const sql = createNeonSqlExecutor(databaseUrl);
  return new IssueRecoveryService(
    new PostgresIssueStatusRepository(sql),
    contacts,
    new ExperienceAccessService(new PostgresExperienceRepository(sql)),
  );
}
