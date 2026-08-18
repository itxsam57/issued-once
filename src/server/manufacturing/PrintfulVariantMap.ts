import { z } from 'zod';

const mappingValue = z.object({
  variantId: z.number().int().positive(),
  fileType: z.string().trim().min(1).max(80).default('front'),
});

const mappingSchema = z.record(z.string().min(1), mappingValue);

export type PrintfulVariantMapping = z.infer<typeof mappingValue>;

export class PrintfulVariantMap {
  private readonly mappings: Record<string, PrintfulVariantMapping>;

  constructor(serialized: string) {
    if (!serialized.trim()) throw new Error('Printful variant mapping is required');
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error('Printful variant mapping is invalid JSON');
    }
    this.mappings = mappingSchema.parse(parsed);
  }

  resolve(input: { objectType: string; sizeCode: string; colorCode: string }): PrintfulVariantMapping {
    const key = `${input.objectType}:${input.sizeCode}:${input.colorCode}`;
    const mapping = this.mappings[key];
    if (!mapping) throw new Error(`Printful mapping is missing for ${key}`);
    return mapping;
  }
}
