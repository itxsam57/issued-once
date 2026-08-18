import { z } from 'zod';
import type { CatalogGateway, CatalogVariant } from './CatalogGateway';

const variantSchema = z.object({
  id: z.string().trim().min(1).max(160),
  size: z.string().trim().min(1).max(40),
  colorName: z.string().trim().min(1).max(80),
  colorSwatch: z.string().trim().max(80).nullable().optional().default(null),
  amountMinor: z.number().int().positive(),
  available: z.boolean().default(true),
});

const productSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  variants: z.array(variantSchema).min(1),
});

const catalogSchema = z.object({
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  products: z.record(z.string().min(1), productSchema),
});

type CatalogConfig = z.infer<typeof catalogSchema>;

export class IssuedOnceCatalogGateway implements CatalogGateway {
  private readonly config: CatalogConfig;

  constructor(serialized: string) {
    let parsed: unknown;
    try { parsed = JSON.parse(serialized); } catch { throw new Error('ISSUED ONCE catalog is invalid JSON'); }
    this.config = catalogSchema.parse(parsed);
    this.config.currency = this.config.currency.toUpperCase();

    const productSlugs = new Set<string>();
    const variantIds = new Set<string>();
    for (const product of Object.values(this.config.products)) {
      if (productSlugs.has(product.slug)) throw new Error('ISSUED ONCE catalog has duplicate product slug');
      productSlugs.add(product.slug);
      for (const variant of product.variants) {
        if (variantIds.has(variant.id)) throw new Error('ISSUED ONCE catalog has duplicate logical variant');
        variantIds.add(variant.id);
      }
    }
  }

  productSlug(objectType: string): string {
    const product = this.config.products[objectType];
    if (!product) throw new Error(`ISSUED ONCE product is not configured: ${objectType}`);
    return product.slug;
  }

  currency(): string {
    return this.config.currency;
  }

  async listVariants(productSlug: string, currency: string): Promise<readonly CatalogVariant[]> {
    if (currency.trim().toUpperCase() !== this.config.currency) {
      throw new Error('ISSUED ONCE catalog currency does not match');
    }
    const product = Object.values(this.config.products).find((candidate) => candidate.slug === productSlug);
    if (!product) throw new Error('ISSUED ONCE catalog product is not configured');
    return product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      colorName: variant.colorName,
      colorSwatch: variant.colorSwatch ?? null,
      amountMinor: variant.amountMinor,
      currency: this.config.currency,
      available: variant.available,
    }));
  }
}
