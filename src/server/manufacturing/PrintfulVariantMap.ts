import { z } from 'zod';
import { ISSUED_ONCE_PRINTFUL_VARIANT_MAP_JSON } from './verifiedPrintfulVariantMap';

const printAreaSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dpi: z.number().int().min(72).max(600),
});

const positionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  top: z.number().int().nonnegative(),
  left: z.number().int().nonnegative(),
});

const mappingValue = z.object({
  variantId: z.number().int().positive(),
  fileType: z.string().trim().min(1).max(80).default('front'),
  printArea: printAreaSchema,
  position: positionSchema,
}).superRefine((value, ctx) => {
  if (value.position.width + value.position.left > value.printArea.width) {
    ctx.addIssue({ code: 'custom', message: 'Print position exceeds print area width', path: ['position'] });
  }
  if (value.position.height + value.position.top > value.printArea.height) {
    ctx.addIssue({ code: 'custom', message: 'Print position exceeds print area height', path: ['position'] });
  }
});

const mappingSchema = z.record(z.string().min(1), mappingValue);

export type PrintfulVariantMapping = z.infer<typeof mappingValue>;

export function readPrintfulVariantMapJson(env: NodeJS.ProcessEnv = process.env): string {
  return env.PRINTFUL_VARIANT_MAP_JSON?.trim() || ISSUED_ONCE_PRINTFUL_VARIANT_MAP_JSON;
}

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
