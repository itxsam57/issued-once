import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { createDesignService } from '@/server/design/runtimeDesign';
import { enqueueDesignIssue } from '@/server/design/designQueue';
import { createManufacturingService } from '@/server/manufacturing/runtimeManufacturing';
import { OpsAuditService } from './OpsAuditService';
import { OpsDesignerService } from './OpsDesignerService';
import { OpsManufacturingService } from './OpsManufacturingService';
import { OpsPrivateRevealService } from './OpsPrivateRevealService';
import { PostgresOpsAuditRepository } from './PostgresOpsAuditRepository';
import { PostgresOpsDashboardRepository } from './PostgresOpsDashboardRepository';
import { PostgresOpsDesignCandidateRepository } from './PostgresOpsDesignCandidateRepository';
import { PostgresOpsDesignerStore } from './PostgresOpsDesignerStore';
import { PostgresOpsIssueDetailRepository } from './PostgresOpsIssueDetailRepository';
import { PostgresOpsManufacturingStore } from './PostgresOpsManufacturingStore';
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

export function createOpsDesignerStore() {
  return new PostgresOpsDesignerStore(sql());
}

export function createOpsDesignCandidateRepository() {
  return new PostgresOpsDesignCandidateRepository(sql());
}

export function createOpsDesignerService() {
  const executor = sql();
  return new OpsDesignerService(
    new PostgresOpsDesignerStore(executor),
    {
      approve: (issueId) => createDesignService().approveForManufacturing(issueId),
      enqueue: (issueId, mode, generationKey) => enqueueDesignIssue(issueId, {
        mode,
        generationKey,
        source: mode === 'regenerate' ? 'OWNER_REGENERATE' : 'OWNER_REINTERPRET',
      }),
    },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}

export function createOpsManufacturingService() {
  const executor = sql();
  const manufacturing = createManufacturingService();
  return new OpsManufacturingService(
    new PostgresOpsManufacturingStore(executor),
    {
      createDraft: (issueId) => manufacturing.createDraft(issueId),
      confirmDraft: (issueId) => manufacturing.confirmDraft(issueId),
    },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
