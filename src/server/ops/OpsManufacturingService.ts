import type { ManufacturingJobRecord } from '@/server/manufacturing/ManufacturingRepository';
import type { OpsAuditService } from './OpsAuditService';

export type OpsManufacturingQueueItem = {
  issueId: string;
  issueCode: string;
  issueStatus: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  designState: string | null;
  manufacturingState: string | null;
  providerOrderId: string | null;
  providerStatus: string | null;
  trackingNumber: string | null;
  updatedAt: Date;
};

export interface OpsManufacturingStore {
  listQueue(limit: number): Promise<OpsManufacturingQueueItem[]>;
  quarantine(issueId: string, reason: string): Promise<void>;
}

export class OpsManufacturingService {
  constructor(
    private readonly store: OpsManufacturingStore,
    private readonly actions: {
      createDraft(issueId: string): Promise<ManufacturingJobRecord>;
      confirmDraft(issueId: string): Promise<ManufacturingJobRecord>;
    },
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  listQueue(limit = 100) { return this.store.listQueue(Math.min(Math.max(Math.trunc(limit), 1), 100)); }

  async createDraft(issueId: string) {
    const job = await this.actions.createDraft(issueId);
    await this.audit.record({
      actor: 'OWNER', action: 'PRINTFUL_DRAFT_CREATED', issueId,
      targetType: 'manufacturing_job', targetId: job.id, reason: null,
      safeMetadata: { state: job.state, providerOrderId: job.providerOrderId ?? null },
    });
    return job;
  }

  async confirmDraft(issueId: string) {
    const job = await this.actions.confirmDraft(issueId);
    await this.audit.record({
      actor: 'OWNER', action: 'PRINTFUL_PRODUCTION_CONFIRMED', issueId,
      targetType: 'manufacturing_job', targetId: job.id, reason: null,
      safeMetadata: { state: job.state },
    });
    return job;
  }

  async quarantine(issueId: string, reason: string) {
    const safeReason = reason.trim();
    if (!safeReason || safeReason.length > 500) throw new Error('A quarantine reason is required');
    await this.store.quarantine(issueId, safeReason);
    await this.audit.record({
      actor: 'OWNER', action: 'MANUFACTURING_QUARANTINED', issueId,
      targetType: 'issue', targetId: issueId, reason: safeReason,
      safeMetadata: { state: 'EXCEPTION' },
    });
  }
}
