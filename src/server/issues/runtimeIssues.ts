import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { IssueService } from './IssueService';
import { PostgresIssueRepository } from './PostgresIssueRepository';

export class IssueRuntimeUnavailableError extends Error {
  constructor(message = 'Issue runtime is not configured') {
    super(message);
    this.name = 'IssueRuntimeUnavailableError';
  }
}

export function createIssueService(): IssueService {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new IssueRuntimeUnavailableError('DATABASE_URL is required');
  return new IssueService(new PostgresIssueRepository(createNeonSqlExecutor(databaseUrl)));
}
