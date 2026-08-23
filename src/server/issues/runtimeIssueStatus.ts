import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { IssueStatusService } from './IssueStatusService';
import { PostgresIssueStatusRepository } from './PostgresIssueStatusRepository';

export class IssueStatusRuntimeUnavailableError extends Error {
  constructor() {
    super('Issue status runtime is not configured');
    this.name = 'IssueStatusRuntimeUnavailableError';
  }
}

export function createIssueStatusService(): IssueStatusService {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new IssueStatusRuntimeUnavailableError();
  return new IssueStatusService(new PostgresIssueStatusRepository(createNeonSqlExecutor(databaseUrl)));
}
