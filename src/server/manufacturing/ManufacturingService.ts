import { randomUUID } from 'node:crypto';
import { decryptPrivatePayload } from '@/server/crypto/privatePayload';
import type { ShippingAddress } from '@/server/shipping/ShippingRepository';
import type { ManufacturerGateway } from './ManufacturerGateway';
import type {
  ManufacturingJobRecord,
  ManufacturingRepository,
} from './ManufacturingRepository';
import type { PrintfulVariantMap } from './PrintfulVariantMap';

export class ManufacturingService {
  constructor(
    private readonly repository: ManufacturingRepository,
    private readonly gateway: ManufacturerGateway,
    private readonly variantMap: PrintfulVariantMap,
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createDraft(issueId: string): Promise<ManufacturingJobRecord> {
    let job = await this.repository.findByIssueId(issueId);
    if (job && job.state !== 'FAILED') return job;

    const input = await this.repository.loadInput(issueId);
    if (!input) throw new Error('Manufacturing input is unavailable');
    if (input.issueStatus !== 'DESIGN_APPROVED' || input.designState !== 'APPROVED') {
      throw new Error('Design must be approved before manufacturing');
    }
    if (!input.artworkUrl.startsWith('https://')) throw new Error('Approved artwork URL is invalid');

    const mapping = this.variantMap.resolve({
      objectType: input.objectType,
      sizeCode: input.sizeCode,
      colorCode: input.colorCode,
    });

    if (!job) {
      const now = this.now();
      const reservation = await this.repository.reserve({
        id: this.idGenerator(),
        issueId: input.issueId,
        designJobId: input.designJobId,
        state: 'RESERVED',
        provider: 'PRINTFUL',
        providerOrderId: null,
        providerStatus: null,
        printfulVariantId: null,
        artworkUrl: input.artworkUrl,
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
      });
      job = reservation.job;
      if (!reservation.created && job.state !== 'FAILED') return job;
    }

    try {
      const [{ email }, address] = await Promise.all([
        decryptPrivatePayload<{ email: string }>(input.encryptedEmail),
        decryptPrivatePayload<ShippingAddress>(input.encryptedAddress),
      ]);
      const draft = await this.gateway.createDraft({
        externalId: input.issueCode,
        variantId: mapping.variantId,
        artworkUrl: input.artworkUrl,
        fileType: mapping.fileType,
        recipient: {
          name: address.recipientName,
          email,
          phone: address.phone,
          address1: address.line1,
          address2: address.line2,
          city: address.city,
          stateCode: address.region,
          countryCode: address.countryCode,
          zip: address.postalCode,
        },
      });
      return await this.repository.attachDraft({
        jobId: job.id,
        providerOrderId: draft.providerOrderId,
        providerStatus: draft.status,
        printfulVariantId: mapping.variantId,
        updatedAt: this.now(),
      });
    } catch (error) {
      await this.repository.markFailed(
        job.id,
        error instanceof Error ? error.name : 'PRINTFUL_DRAFT_FAILURE',
        this.now(),
      );
      throw error;
    }
  }

  async confirmDraft(issueId: string): Promise<ManufacturingJobRecord> {
    const job = await this.repository.findByIssueId(issueId);
    if (!job) throw new Error('Manufacturing draft does not exist');
    if (job.state === 'IN_PRODUCTION' || job.state === 'SHIPPED' || job.state === 'DELIVERED') return job;
    if (job.state !== 'DRAFT' || !job.providerOrderId) throw new Error('Manufacturing draft is not ready to confirm');

    await this.gateway.confirmDraft(job.providerOrderId);
    return this.repository.markConfirmed({ jobId: job.id, confirmedAt: this.now() });
  }
}
