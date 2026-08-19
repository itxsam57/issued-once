import { randomUUID } from 'node:crypto';
import type { CheckoutQuoteRecord } from '@/server/checkout/CheckoutService';
import type { ExperienceRepository } from '@/server/experience/ExperienceRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { CatalogGateway } from './CatalogGateway';
import type { BaseSelectionRepository } from './PhysicalSelectionRepository';

type QuoteWriter = {
  create(record: CheckoutQuoteRecord): Promise<void>;
};

type BaseSelectionServiceDependencies = {
  experienceRepository: Pick<ExperienceRepository, 'findBySessionHash'>;
  physicalRepository: BaseSelectionRepository;
  quoteRepository: QuoteWriter;
  catalog: CatalogGateway;
  currency: string;
  now?: () => Date;
  createQuoteId?: () => string;
  quoteTtlMs?: number;
};

export class BaseSelectionService {
  private readonly now: () => Date;
  private readonly createQuoteId: () => string;
  private readonly quoteTtlMs: number;

  constructor(private readonly dependencies: BaseSelectionServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createQuoteId = dependencies.createQuoteId ?? (() => randomUUID());
    this.quoteTtlMs = dependencies.quoteTtlMs ?? 60 * 60 * 1000;
  }

  async confirm(input: { sessionToken: string; colorCode: string }): Promise<{
    quoteId: string;
    amountMinor: number;
    currency: string;
    expiresAt: string;
  }> {
    const experience = await this.dependencies.experienceRepository.findBySessionHash(
      hashSessionToken(input.sessionToken),
    );
    if (!experience) throw new Error('Experience not found');
    if (experience.stage !== 'SIZE_CONFIRMED') {
      throw new Error('Base selection is not unlocked');
    }

    const physical = await this.dependencies.physicalRepository.findByExperienceId(experience.id);
    if (!physical) throw new Error('Physical selection not found');

    const sizeCode = physical.sizeCode?.trim();
    if (!sizeCode) throw new Error('Confirmed size is missing');

    const colorCode = input.colorCode.trim();
    if (!colorCode) throw new Error('Selected base is unavailable');

    const variants = await this.dependencies.catalog.listVariants(
      physical.productSlug,
      this.dependencies.currency,
    );
    const matching = variants.filter(
      (variant) =>
        variant.available &&
        variant.size === sizeCode &&
        variant.colorName === colorCode &&
        variant.currency === this.dependencies.currency,
    );

    if (matching.length === 0) throw new Error('Selected base is unavailable');
    if (matching.length !== 1) throw new Error('Selected base is ambiguous');

    const variant = matching[0];
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.quoteTtlMs);
    const quoteId = this.createQuoteId();

    await this.dependencies.quoteRepository.create({
      id: quoteId,
      experienceId: experience.id,
      productSlug: physical.productSlug,
      variantId: variant.id,
      amountMinor: variant.amountMinor,
      currency: variant.currency,
      expiresAt,
    });

    await this.dependencies.physicalRepository.confirmBaseAndAdvance({
      experienceId: experience.id,
      expectedStage: 'SIZE_CONFIRMED',
      nextStage: 'COMMITMENT_READY',
      colorCode,
      colorLabel: variant.colorName,
      colorSwatch: variant.colorSwatch,
      variantId: variant.id,
      updatedAt: now,
    });

    return {
      quoteId,
      amountMinor: variant.amountMinor,
      currency: variant.currency,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
