import type { ManufacturingEventRepository } from './ManufacturingEventRepository';
import type { PrintfulWebhookVerifier } from './PrintfulWebhookVerifier';

type ReferralDeliveryLifecycle = {
  markDeliveredIssue(issueId: string): Promise<unknown>;
};

export class ManufacturingEventService {
  constructor(
    private readonly verifier: PrintfulWebhookVerifier,
    private readonly repository: ManufacturingEventRepository,
    private readonly referrals?: ReferralDeliveryLifecycle,
  ) {}

  async handle(input: { rawBody: string; headers: Headers }) {
    const event = this.verifier.verify(input);
    const result = await this.repository.applyProviderEvent(event);
    if (result.kind === 'mismatch') throw new Error('Printful event cross-link mismatch');

    if (
      this.referrals &&
      result.issueId &&
      event.type === 'SHIPMENT_DELIVERED' &&
      (result.kind === 'applied' || result.kind === 'duplicate')
    ) {
      await this.referrals.markDeliveredIssue(result.issueId);
    }

    return {
      ...result,
      eventType: event.type,
    };
  }
}
