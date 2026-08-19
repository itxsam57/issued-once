import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { OpsAuditService } from './OpsAuditService';
import { OpsPrivateRevealService } from './OpsPrivateRevealService';
import { PostgresOpsAuditRepository } from './PostgresOpsAuditRepository';
import { PostgresOpsDashboardRepository } from './PostgresOpsDashboardRepository';
import { PostgresOpsIssueDetailRepository } from './PostgresOpsIssueDetailRepository';
import { PostgresOpsPrivateSource } from './PostgresOpsPrivateSource';
import { OpsRuntimeUnavailableError } from './runtimeOps';

function sql() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new OpsRuntimeUnavailableError('DATABASE_URL is required');
  return createNeonSqlExecutor(databaseUrl);
}

export function createOpsAuditService() {
  return new OpsAuditService(new PostgresOpsAuditRepository(sql()));
}

export function createOpsDashboardRepository() {
  return new PostgresOpsDashboardRepository(sql());
}

export function createOpsIssueDetailRepository() {
  return new PostgresOpsIssueDetailRepository(sql());
}

export function createOpsPrivateRevealService() {
  const executor = sql();
  return new OpsPrivateRevealService(
    new PostgresOpsPrivateSource(executor),
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
