import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { createDesignService } from '@/server/design/runtimeDesign';
import { enqueueDesignIssue } from '@/server/design/designQueue';
import { dispatchPaidIssueDesign } from '@/server/design/designDispatch';
import { DesignPolicyWorkflowService } from '@/server/design/DesignPolicyWorkflowService';
import { PostgresArtworkStorage } from '@/server/design/PostgresArtworkStorage';
import { PostgresDesignPolicyRepository } from '@/server/design/PostgresDesignPolicyRepository';
import { createIssueService } from '@/server/issues/runtimeIssues';
import { createManufacturingService } from '@/server/manufacturing/runtimeManufacturing';
import { PrintfulVariantMap } from '@/server/manufacturing/PrintfulVariantMap';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';
import { finalizeRefundedAttempt } from '@/server/payments/finalizeRefundedAttempt';
import { createPaymentService } from '@/server/payments/runtimePayments';
import { ManualArtworkUploadService } from './ManualArtworkUploadService';
import { OpsAuditService } from './OpsAuditService';
import { OpsDesignPolicyService } from './OpsDesignPolicyService';
import { OpsDesignerService } from './OpsDesignerService';
import { OpsManufacturingService } from './OpsManufacturingService';
import { OpsPrivateRevealService } from './OpsPrivateRevealService';
import { OpsRecoveryService } from './OpsRecoveryService';
import { OpsReferralService } from './OpsReferralService';
import { OpsRefundService } from './OpsRefundService';
import { OpsSupportService } from './OpsSupportService';
import { OpsWebsiteService, opsCatalogSchema } from './OpsWebsiteService';
import { PostgresOpsAttentionRepository } from './PostgresOpsAttentionRepository';
import { PostgresOpsAuditRepository } from './PostgresOpsAuditRepository';
import { PostgresOpsCustomerRepository } from './PostgresOpsCustomerRepository';
import { PostgresOpsDashboardRepository } from './PostgresOpsDashboardRepository';
import { PostgresOpsDesignCandidateRepository } from './PostgresOpsDesignCandidateRepository';
import { PostgresOpsDesignerStore } from './PostgresOpsDesignerStore';
import { PostgresOpsIssueDetailRepository } from './PostgresOpsIssueDetailRepository';
import { PostgresOpsManufacturingStore } from './PostgresOpsManufacturingStore';
import { PostgresOpsPrivateSource } from './PostgresOpsPrivateSource';
import { PostgresOpsReferralRepository } from './PostgresOpsReferralRepository';
import { PostgresOpsSalesRepository } from './PostgresOpsSalesRepository';
import { PostgresOpsSupportStore } from './PostgresOpsSupportStore';
import { PostgresOpsWebsiteStore } from './PostgresOpsWebsiteStore';
import { ResendOpsSupportReplyGateway } from './ResendOpsSupportReplyGateway';
import { OpsRuntimeUnavailableError } from './runtimeOps';

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new OpsRuntimeUnavailableError(`${name} is required`);
  return value;
}
function sql() { return createNeonSqlExecutor(env('DATABASE_URL')); }
function factoryMappingKeys(): string[] {
  const serialized = process.env.PRINTFUL_VARIANT_MAP_JSON?.trim();
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : [];
  } catch {
    return [];
  }
}

export function createOpsAuditService() { return new OpsAuditService(new PostgresOpsAuditRepository(sql())); }
export function createOpsDashboardRepository() { return new PostgresOpsDashboardRepository(sql()); }
export function createOpsIssueDetailRepository() { return new PostgresOpsIssueDetailRepository(sql()); }
export function createOpsAttentionRepository() { return new PostgresOpsAttentionRepository(sql(), factoryMappingKeys()); }
export function createOpsPrivateRevealService() {
  const executor = sql();
  return new OpsPrivateRevealService(new PostgresOpsPrivateSource(executor), new OpsAuditService(new PostgresOpsAuditRepository(executor)));
}
export function createOpsDesignPolicyService() {
  const executor = sql();
  return new OpsDesignPolicyService(
    new PostgresDesignPolicyRepository(executor),
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
export function createDesignPolicyWorkflowService() {
  const executor = sql();
  return new DesignPolicyWorkflowService(
    new PostgresDesignPolicyRepository(executor),
    {
      approve: (issueId) => createDesignService().approveForManufacturing(issueId),
      createDraft: (issueId) => createManufacturingService().createDraft(issueId),
    },
  );
}
export function createOpsDesignerStore() { return new PostgresOpsDesignerStore(sql()); }
export function createOpsDesignCandidateRepository() { return new PostgresOpsDesignCandidateRepository(sql()); }
export function createOpsDesignerService() {
  const executor = sql();
  return new OpsDesignerService(
    new PostgresOpsDesignerStore(executor),
    {
      approve: (issueId) => createDesignPolicyWorkflowService().afterOwnerApproval(issueId),
      enqueue: (issueId, mode, generationKey, feedback) => enqueueDesignIssue(issueId, {
        mode,
        generationKey,
        source: mode === 'regenerate' ? 'OWNER_REGENERATE' : 'OWNER_REINTERPRET',
        ...(feedback ? { feedback } : {}),
      }),
    },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
    new PostgresDesignPolicyRepository(executor),
  );
}
export function createManualArtworkUploadService() {
  const executor = sql();
  return new ManualArtworkUploadService(
    new PostgresDesignPolicyRepository(executor),
    new PostgresOpsDesignerStore(executor),
    new PostgresArtworkStorage(executor),
    { approve: (issueId) => createDesignPolicyWorkflowService().afterOwnerApproval(issueId) },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
export function createOpsManufacturingService() {
  const executor = sql();
  const manufacturing = createManufacturingService();
  return new OpsManufacturingService(
    new PostgresOpsManufacturingStore(executor),
    { createDraft: (issueId) => manufacturing.createDraft(issueId), confirmDraft: (issueId) => manufacturing.confirmDraft(issueId) },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
export function createOpsSalesRepository() { return new PostgresOpsSalesRepository(sql()); }
export function createOpsCustomerRepository() { return new PostgresOpsCustomerRepository(sql()); }
export function createOpsReferralService() {
  const executor = sql();
  return new OpsReferralService({
    repository: new PostgresOpsReferralRepository(executor),
    audit: new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  });
}
export function createOpsRefundService() {
  const executor = sql();
  return new OpsRefundService(
    new PostgresOpsIssueDetailRepository(executor),
    createPaymentService(),
    finalizeRefundedAttempt,
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
export function createOpsSupportService() {
  const executor = sql();
  return new OpsSupportService(
    new PostgresOpsSupportStore(executor),
    new ResendOpsSupportReplyGateway({ apiKey: env('RESEND_API_KEY'), from: env('RESEND_FROM_EMAIL') }),
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
    { enqueue: (issueId, eventKey, attemptKey) => enqueueIssueNotification(issueId, eventKey, attemptKey) },
  );
}
export function createOpsWebsiteService() {
  const executor = sql();
  const bootJson = process.env.ISSUED_ONCE_CATALOG_JSON?.trim() || ISSUED_ONCE_BOOT_CATALOG_JSON;
  const boot = opsCatalogSchema.parse(JSON.parse(bootJson));
  return new OpsWebsiteService(
    new PostgresOpsWebsiteStore(executor, boot),
    { bootCatalogJson: bootJson, assertFactoryMapping: (input) => { new PrintfulVariantMap(env('PRINTFUL_VARIANT_MAP_JSON')).resolve(input); } },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
export function createOpsRecoveryService() {
  const executor = sql();
  return new OpsRecoveryService(
    {
      reserveIssue: (paymentAttemptId) => createIssueService().reserveForPaidAttempt(paymentAttemptId),
      enqueueDesign: (issueId) => dispatchPaidIssueDesign(issueId),
      enqueuePaymentNotification: (issueId) => enqueueIssueNotification(issueId, 'PAYMENT_RECEIVED'),
    },
    new OpsAuditService(new PostgresOpsAuditRepository(executor)),
  );
}
