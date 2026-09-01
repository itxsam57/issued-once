import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';
import type { DesignPolicy } from '@/server/design/DesignPolicy';
import { readValidatedPngImage } from '@/server/design/PngImage';
import type { OpsAuditService } from './OpsAuditService';

const MIN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  tee: { width: 1024, height: 1536 },
  hoodie: { width: 1024, height: 1536 },
  tote: { width: 1024, height: 1536 },
  hat: { width: 1024, height: 1024 },
};

export interface ManualArtworkPolicyReader {
  getEffective(issueId: string): Promise<{ globalVersion: number; override: unknown; policy: DesignPolicy }>;
}

export interface ManualArtworkStore {
  prepareManualUpload(issueId: string): Promise<{ designJobId: string; objectType: string }>;
  saveManualCandidate(input: {
    issueId: string;
    designJobId: string;
    generationKey: string;
    source: 'OWNER_UPLOAD';
    artworkUrl: string;
    artworkMimeType: 'image/png';
    artworkBytes: number;
    width: number;
    height: number;
    provider: 'OWNER';
    model: 'MANUAL_UPLOAD';
    safeSummary: string;
  }): Promise<{ candidateId: string }>;
}

export class ManualArtworkUploadService {
  constructor(
    private readonly policies: ManualArtworkPolicyReader,
    private readonly store: ManualArtworkStore,
    private readonly storage: ArtworkStorageGateway,
    private readonly actions: { approve(issueId: string): Promise<unknown> },
    private readonly audit: Pick<OpsAuditService, 'record'>,
    private readonly keyGenerator: () => string = () => crypto.randomUUID(),
  ) {}

  async upload(input: {
    issueId: string;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) throw new Error('A manual artwork upload reason is required');
    if (input.mimeType !== 'image/png' || !input.fileName.toLowerCase().endsWith('.png')) {
      throw new Error('Manual artwork must be PNG');
    }
    if (input.bytes.length < 10_000) throw new Error('Manual artwork bytes are empty or implausibly small');

    const prepared = await this.store.prepareManualUpload(input.issueId);
    const { width, height, hasTransparency } = readValidatedPngImage(input.bytes);
    if (!hasTransparency) throw new Error('Manual artwork PNG must contain transparent pixels');
    const minimum = MIN_DIMENSIONS[prepared.objectType];
    if (!minimum) throw new Error('Object type has no approved print profile');
    if (width < minimum.width || height < minimum.height) {
      throw new Error('Manual artwork dimensions are below the approved print profile');
    }

    const generationKey = `owner-upload:${this.keyGenerator()}`;
    const stored = await this.storage.put({
      issueId: input.issueId,
      designJobId: `${prepared.designJobId}-${generationKey}`,
      bytes: input.bytes,
      mimeType: 'image/png',
    });
    const saved = await this.store.saveManualCandidate({
      issueId: input.issueId,
      designJobId: prepared.designJobId,
      generationKey,
      source: 'OWNER_UPLOAD',
      artworkUrl: stored.url,
      artworkMimeType: 'image/png',
      artworkBytes: stored.bytes,
      width,
      height,
      provider: 'OWNER',
      model: 'MANUAL_UPLOAD',
      safeSummary: 'Owner-uploaded production artwork',
    });

    const effective = await this.policies.getEffective(input.issueId);
    const approved = effective.policy.manualUploadApproval === 'AUTO_APPROVE';
    if (approved) await this.actions.approve(input.issueId);

    await this.audit.record({
      actor: 'OWNER',
      action: 'DESIGN_MANUAL_UPLOAD',
      issueId: input.issueId,
      targetType: 'design_candidate',
      targetId: saved.candidateId,
      reason,
      safeMetadata: {
        source: 'OWNER_UPLOAD',
        width,
        height,
        artworkBytes: stored.bytes,
        policyVersion: effective.globalVersion,
        approved,
      },
    });

    return { candidateId: saved.candidateId, width, height, approved };
  }
}
