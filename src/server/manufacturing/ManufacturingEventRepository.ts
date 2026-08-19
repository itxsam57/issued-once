import type { NormalizedPrintfulEvent } from './PrintfulWebhookVerifier';

export type ManufacturingEventKind = 'applied' | 'duplicate' | 'unknown-order' | 'mismatch';

export type ManufacturingEventApplyResult = {
  kind: ManufacturingEventKind;
  issueId?: string;
};

export interface ManufacturingEventRepository {
  applyProviderEvent(event: NormalizedPrintfulEvent): Promise<ManufacturingEventApplyResult>;
}
