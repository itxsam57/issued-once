import { randomUUID } from 'node:crypto';
import type { CheckoutQuoteRecord } from '@/server/checkout/CheckoutService';
import type { CatalogGateway } from '@/server/physical/CatalogGateway';
import type { ObjectType, PhysicalSelectionRecord } from '@/server/physical/PhysicalSelectionRepository';
import type { VerifiedContactRecord } from '@/server/contact/ContactRepository';
import type { ShippingSnapshotRecord } from '@/server/shipping/ShippingRepository';
import { hashSessionToken } from '@/server/http/sessionToken';
import type { ExperienceRepository } from './ExperienceRepository';

export type ResumePhase = 'form' | 'size' | 'base' | 'contact' | 'shipping' | 'commitment';
export type ResumeSize = { code: string; label: string };
export type ResumeColor = { code: string; label: string; swatch?: string };
export type ResumeQuote = { quoteId: string; amountMinor: number; currency: string; expiresAt: string };

export type ExperienceResumeState = {
  phase: ResumePhase;
  object?: ObjectType;
  sizeCode?: string;
  color?: { code: string; label: string };
  sizes?: ResumeSize[];
  colors?: ResumeColor[];
  quote?: ResumeQuote;
};

type Dependencies = {
  experiences: Pick<ExperienceRepository, 'findBySessionHash'>;
  physical: { findByExperienceId(experienceId: string): Promise<PhysicalSelectionRecord | null> };
  quotes: {
    findLatestByExperienceId(experienceId: string): Promise<CheckoutQuoteRecord | null>;
    create(record: CheckoutQuoteRecord): Promise<void>;
  };
  contacts: { findVerifiedByExperienceId(experienceId: string): Promise<VerifiedContactRecord | null> };
  shipping: { findByExperienceId(experienceId: string): Promise<ShippingSnapshotRecord | null> };
  catalog: CatalogGateway;
  currency: string;
  now?: () => Date;
  createQuoteId?: () => string;
  quoteTtlMs?: number;
};

export class ExperienceResumeService {
  private readonly now: () => Date;
  private readonly createQuoteId: () => string;
  private readonly quoteTtlMs: number;

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createQuoteId = dependencies.createQuoteId ?? (() => randomUUID());
    this.quoteTtlMs = dependencies.quoteTtlMs ?? 60 * 60 * 1000;
  }

  private async requirePhysical(experienceId: string) {
    const physical = await this.dependencies.physical.findByExperienceId(experienceId);
    if (!physical) throw new Error('Saved physical selection was not found');
    return physical;
  }

  private async variants(physical: PhysicalSelectionRecord) {
    return this.dependencies.catalog.listVariants(physical.productSlug, this.dependencies.currency);
  }

  async read(sessionToken: string): Promise<ExperienceResumeState> {
    const experience = await this.dependencies.experiences.findBySessionHash(hashSessionToken(sessionToken));
    if (!experience) throw new Error('Experience not found');

    if (experience.stage === 'PROFILE_COMPLETE') return { phase: 'form' };

    const physical = await this.requirePhysical(experience.id);
    const variants = await this.variants(physical);

    if (experience.stage === 'OBJECT_SELECTED') {
      const seen = new Set<string>();
      const sizes: ResumeSize[] = [];
      for (const variant of variants) {
        const size = variant.size.trim();
        if (!variant.available || !size || seen.has(size)) continue;
        seen.add(size);
        sizes.push({ code: size, label: size });
      }
      if (!sizes.length) throw new Error('Saved object no longer has available sizes');
      return { phase: 'size', object: physical.object, sizes };
    }

    const sizeCode = physical.sizeCode?.trim();
    if (!sizeCode) throw new Error('Saved size was not found');

    if (experience.stage === 'SIZE_CONFIRMED') {
      const seen = new Set<string>();
      const colors: ResumeColor[] = [];
      for (const variant of variants) {
        const label = variant.colorName.trim();
        if (!variant.available || variant.size !== sizeCode || !label || seen.has(label)) continue;
        seen.add(label);
        colors.push({ code: label, label, ...(variant.colorSwatch ? { swatch: variant.colorSwatch } : {}) });
      }
      if (!colors.length) throw new Error('Saved size no longer has available colors');
      return { phase: 'base', object: physical.object, sizeCode, colors };
    }

    if (experience.stage !== 'COMMITMENT_READY') {
      throw new Error('Experience is not resumable from this stage');
    }

    const colorCode = physical.colorCode?.trim();
    const colorLabel = physical.colorLabel?.trim();
    const variantId = physical.variantId?.trim();
    if (!colorCode || !colorLabel || !variantId) throw new Error('Saved base selection was not found');

    const variant = variants.find((candidate) =>
      candidate.available &&
      candidate.id === variantId &&
      candidate.size === sizeCode &&
      candidate.colorName === colorCode &&
      candidate.currency === this.dependencies.currency
    );
    if (!variant) throw new Error('Saved base selection is no longer available');

    const now = this.now();
    let quote = await this.dependencies.quotes.findLatestByExperienceId(experience.id);
    const quoteStillCurrent = Boolean(
      quote &&
      quote.expiresAt.getTime() > now.getTime() &&
      quote.productSlug === physical.productSlug &&
      quote.variantId === variant.id &&
      quote.amountMinor === variant.amountMinor &&
      quote.currency === variant.currency,
    );

    if (!quoteStillCurrent) {
      quote = {
        id: this.createQuoteId(),
        experienceId: experience.id,
        productSlug: physical.productSlug,
        variantId: variant.id,
        amountMinor: variant.amountMinor,
        currency: variant.currency,
        expiresAt: new Date(now.getTime() + this.quoteTtlMs),
      };
      await this.dependencies.quotes.create(quote);
    }
    if (!quote) throw new Error('Checkout quote could not be restored');

    const contact = await this.dependencies.contacts.findVerifiedByExperienceId(experience.id);
    const shipping = contact
      ? await this.dependencies.shipping.findByExperienceId(experience.id)
      : null;
    const phase: ResumePhase = !contact ? 'contact' : !shipping ? 'shipping' : 'commitment';

    return {
      phase,
      object: physical.object,
      sizeCode,
      color: { code: colorCode, label: colorLabel },
      quote: {
        quoteId: quote.id,
        amountMinor: quote.amountMinor,
        currency: quote.currency,
        expiresAt: quote.expiresAt.toISOString(),
      },
    };
  }
}
