import type { OpsAuditService } from './OpsAuditService';

export type OpsDesignReworkMode = 'regenerate' | 'reinterpret';

export type OpsDesignerQueueItem = {
  issueId: string;
  issueCode: string;
  issueStatus: string;
  objectType: string;
  sizeCode: string;
  colorCode: string;
  designJobId: string;
  designState: string;
  artworkUrl: string | null;
  width: number | null;
  height: number | null;
  provider: string | null;
  model: string | null;
  candidateCount: number;
  updatedAt: Date;
};

export interface OpsDesignerStore {
  listQueue(limit: number): Promise<OpsDesignerQueueItem[]>;
  prepareRework(issueId: string, mode: OpsDesignReworkMode): Promise<{ issueId: string; generationKey: string; mode: OpsDesignReworkMode }>;
  prepareRetry(issueId: string): Promise<{ issueId: string; generationKey: string }>;
  selectCandidate(issueId: string, candidateId: string): Promise<void>;
}

export class OpsDesignerService {
  constructor(
    private readonly store: OpsDesignerStore,
    private readonly actions: {
      approve(issueId: string): Promise<unknown>;
      enqueue(issueId: string, mode: OpsDesignReworkMode, generationKey: string): Promise<unknown>;
    },
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  listQueue(limit = 100) {
    return this.store.listQueue(Math.min(Math.max(Math.trunc(limit), 1), 100));
  }

  async approve(issueId: string) {
    const result = await this.actions.approve(issueId);
    await this.audit.record({
      actor: 'OWNER', action: 'DESIGN_APPROVED', issueId,
      targetType: 'design_job', targetId: issueId, reason: null,
      safeMetadata: { state: 'APPROVED' },
    });
    return result;
  }

  async retryFailed(issueId: string) {
    const prepared = await this.store.prepareRetry(issueId);
    await this.actions.enqueue(prepared.issueId, 'reinterpret', prepared.generationKey);
    await this.audit.record({
      actor: 'OWNER', action: 'DESIGN_RETRY', issueId,
      targetType: 'design_job', targetId: issueId, reason: null,
      safeMetadata: { generationKey: prepared.generationKey, mode: 'reinterpret' },
    });
    return prepared;
  }

  async rework(input: { issueId: string; mode: OpsDesignReworkMode; reason: string }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new Error('A design rework reason is required');
    const prepared = await this.store.prepareRework(input.issueId, input.mode);
    await this.actions.enqueue(prepared.issueId, prepared.mode, prepared.generationKey);
    await this.audit.record({
      actor: 'OWNER',
      action: input.mode === 'regenerate' ? 'DESIGN_REGENERATE' : 'DESIGN_REINTERPRET',
      issueId: input.issueId,
      targetType: 'design_job',
      targetId: input.issueId,
      reason,
      safeMetadata: { generationKey: prepared.generationKey, mode: prepared.mode },
    });
    return prepared;
  }

  async reject(input: { issueId: string; reason: string; next?: OpsDesignReworkMode }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new Error('A rejection reason is required');
    const next = input.next ?? 'regenerate';
    const prepared = await this.store.prepareRework(input.issueId, next);
    await this.actions.enqueue(prepared.issueId, prepared.mode, prepared.generationKey);
    await this.audit.record({
      actor: 'OWNER', action: 'DESIGN_REJECTED', issueId: input.issueId,
      targetType: 'design_job', targetId: input.issueId, reason,
      safeMetadata: { next: prepared.mode, generationKey: prepared.generationKey },
    });
    return prepared;
  }

  async selectCandidate(input: { issueId: string; candidateId: string; reason: string }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new Error('A candidate selection reason is required');
    await this.store.selectCandidate(input.issueId, input.candidateId);
    await this.audit.record({
      actor: 'OWNER', action: 'DESIGN_CANDIDATE_SELECTED', issueId: input.issueId,
      targetType: 'design_candidate', targetId: input.candidateId, reason,
      safeMetadata: { state: 'REVIEW' },
    });
  }
}
