import { z } from 'zod';
import type { OpsAuditService } from './OpsAuditService';

const variantSchema = z.object({
  id: z.string().trim().min(1).max(160),
  size: z.string().trim().min(1).max(40),
  colorName: z.string().trim().min(1).max(80),
  colorSwatch: z.string().trim().max(80).nullable().optional().default(null),
  amountMinor: z.number().int().positive(),
  available: z.boolean(),
});
const productSchema = z.object({ slug: z.string().trim().min(1).max(100), variants: z.array(variantSchema).min(1) });
export const opsCatalogSchema = z.object({
  currency: z.enum(['USD','PKR']),
  products: z.record(z.string().min(1), productSchema),
});
export type OpsCatalogPayload = z.infer<typeof opsCatalogSchema>;

const quickPriceSchema = z.object({
  productKey: z.enum(['tee', 'hat', 'tote']),
  amountMinor: z.number().int().positive(),
  currency: z.enum(['USD', 'PKR']),
});

export type OpsQuestionControl = {
  questionId: string;
  version: number;
  family: string;
  prompt: string;
  kind: 'text' | 'choice';
  optional: boolean;
  choices: unknown;
  active: boolean;
  weight: number;
  usageCount: number;
};

export type OpsWebsiteState = {
  catalog: { source: 'BOOT' | 'ACTIVE'; version: number; payload: OpsCatalogPayload };
  questions: OpsQuestionControl[];
};

export interface OpsWebsiteStore {
  getState(): Promise<OpsWebsiteState>;
  publishCatalog(payload: OpsCatalogPayload): Promise<number>;
  updateQuestion(input: { questionId: string; version: number; active: boolean; weight: number }): Promise<void>;
  createQuestionVersion(input: { questionId: string; family: string; prompt: string; kind: 'text' | 'choice'; optional: boolean; choices?: unknown }): Promise<number>;
}

function productSlugs(payload: OpsCatalogPayload) {
  return Object.fromEntries(Object.entries(payload.products).map(([key, product]) => [key, product.slug]));
}

function validChoiceList(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 2 && value.every((choice) => {
    if (!choice || typeof choice !== 'object') return false;
    const candidate = choice as { value?: unknown; label?: unknown };
    return typeof candidate.value === 'string' && candidate.value.trim().length > 0
      && typeof candidate.label === 'string' && candidate.label.trim().length > 0;
  });
}

export class OpsWebsiteService {
  constructor(
    private readonly store: OpsWebsiteStore,
    private readonly runtime: { bootCatalogJson: string; assertFactoryMapping(input: { objectType: string; sizeCode: string; colorCode: string }): void },
    private readonly audit: Pick<OpsAuditService, 'record'>,
  ) {}

  getState() { return this.store.getState(); }

  async publishCatalog(input: unknown) {
    const payload = opsCatalogSchema.parse(input);
    const boot = opsCatalogSchema.parse(JSON.parse(this.runtime.bootCatalogJson));
    if (payload.currency !== boot.currency) throw new Error('Catalog currency cannot change from the boot catalog');
    const bootSlugs = productSlugs(boot);
    const nextSlugs = productSlugs(payload);
    for (const [objectType, slug] of Object.entries(bootSlugs)) {
      if (nextSlugs[objectType] !== slug) throw new Error(`Catalog product slug cannot change: ${objectType}`);
    }
    const ids = new Set<string>();
    for (const [objectType, product] of Object.entries(payload.products)) {
      for (const variant of product.variants) {
        if (ids.has(variant.id)) throw new Error('Catalog logical variant IDs must be unique');
        ids.add(variant.id);
        if (variant.available) this.runtime.assertFactoryMapping({ objectType, sizeCode: variant.size, colorCode: variant.colorName });
      }
    }
    const version = await this.store.publishCatalog(payload);
    await this.audit.record({
      actor: 'OWNER', action: 'CATALOG_PUBLISHED', issueId: null,
      targetType: 'catalog_version', targetId: String(version), reason: null,
      safeMetadata: { version, currency: payload.currency, productCount: Object.keys(payload.products).length },
    });
    return version;
  }

  async publishProductPrice(input: unknown) {
    const requested = quickPriceSchema.parse(input);
    const state = await this.store.getState();
    const current = state.catalog.payload;
    if (requested.currency !== current.currency) throw new Error('Quick price currency must match the current catalog');
    const product = current.products[requested.productKey];
    if (!product) throw new Error(`Catalog product is not configured: ${requested.productKey}`);
    if (!product.variants.some((variant) => variant.available)) throw new Error(`Catalog product has no sellable variants: ${requested.productKey}`);

    const next: OpsCatalogPayload = {
      ...current,
      products: {
        ...current.products,
        [requested.productKey]: {
          ...product,
          variants: product.variants.map((variant) => variant.available
            ? { ...variant, amountMinor: requested.amountMinor }
            : { ...variant }),
        },
      },
    };
    return this.publishCatalog(next);
  }

  async updateQuestion(input: { questionId: string; version: number; active: boolean; weight: number }) {
    if (!Number.isFinite(input.weight) || input.weight < 0.1 || input.weight > 100) throw new Error('Question weight must be between 0.1 and 100');
    await this.store.updateQuestion(input);
    await this.audit.record({
      actor: 'OWNER', action: 'QUESTION_CONTROL_UPDATED', issueId: null,
      targetType: 'question_definition', targetId: `${input.questionId}@${input.version}`, reason: null,
      safeMetadata: { active: input.active, weight: input.weight },
    });
  }

  async createQuestionVersion(input: { questionId: string; family: string; prompt: string; kind: 'text' | 'choice'; optional: boolean; choices?: unknown }) {
    const prompt = input.prompt.trim();
    if (!prompt || prompt.length > 1000) throw new Error('Question prompt is invalid');
    if (input.kind === 'choice' && !validChoiceList(input.choices)) throw new Error('Choice questions require at least two valid choices');
    if (input.kind === 'text' && input.choices != null) throw new Error('Text questions cannot define choices');
    const version = await this.store.createQuestionVersion({ ...input, prompt });
    await this.audit.record({
      actor: 'OWNER', action: 'QUESTION_VERSION_CREATED', issueId: null,
      targetType: 'question_definition', targetId: `${input.questionId}@${version}`, reason: null,
      safeMetadata: { family: input.family, version, kind: input.kind, optional: input.optional },
    });
    return version;
  }
}
