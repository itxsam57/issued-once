import type { NormalizedPrintfulEvent } from './PrintfulWebhookVerifier';

export type ManufacturingEventApplyResult = 'applied' | 'duplicate' | 'unknown-order' | 'mismatch';

export interface ManufacturingEventRepository {
  applyProviderEvent(event: NormalizedPrintfulEvent): Promise<ManufacturingEventApplyResult>;
}
