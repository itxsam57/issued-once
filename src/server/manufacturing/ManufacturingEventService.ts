import type { ManufacturingEventRepository } from './ManufacturingEventRepository';
import type { PrintfulWebhookVerifier } from './PrintfulWebhookVerifier';

export class ManufacturingEventService {
  constructor(
    private readonly verifier: PrintfulWebhookVerifier,
    private readonly repository: ManufacturingEventRepository,
  ) {}

  async handle(input: { rawBody: string; headers: Headers }) {
    const event = this.verifier.verify(input);
    const result = await this.repository.applyProviderEvent(event);
    if (result === 'mismatch') throw new Error('Printful event cross-link mismatch');
    return { kind: result };
  }
}
