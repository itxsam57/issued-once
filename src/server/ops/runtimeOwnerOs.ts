import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { OpsAuditService } from './OpsAuditService';
import { PostgresOpsAuditRepository } from './PostgresOpsAuditRepository';
import { PostgresOpsDashboardRepository } from './PostgresOpsDashboardRepository';
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
