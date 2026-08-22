import type { CatalogGateway, CatalogVariant } from '@/server/physical/CatalogGateway';

const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;
const TEE_COLORS = [
  { code: 'bone', name: 'Bone', swatch: '#e8e0cf' },
  { code: 'black', name: 'Black', swatch: '#171713' },
  { code: 'ash', name: 'Ash', swatch: '#aaa69d' },
  { code: 'navy', name: 'Navy', swatch: '#202834' },
  { code: 'forest', name: 'Forest', swatch: '#344238' },
] as const;

const PREVIEW_TEE_VARIANTS: CatalogVariant[] = TEE_SIZES.flatMap((size) =>
  TEE_COLORS.map((color) => ({
    id: `tee-${size.toLowerCase()}-${color.code}`,
    size,
    colorName: color.name,
    colorSwatch: color.swatch,
    amountMinor: 3200,
    currency: 'USD',
    available: true,
  })),
);

const PREVIEW_VARIANTS: Record<string, readonly CatalogVariant[]> = {
  'preview-tee': PREVIEW_TEE_VARIANTS,
  'preview-hoodie': [
    { id: 'hoodie-s-black', size: 'S', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, currency: 'USD', available: true },
    { id: 'hoodie-m-bone', size: 'M', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 5400, currency: 'USD', available: true },
    { id: 'hoodie-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, currency: 'USD', available: true },
    { id: 'hoodie-l-ash', size: 'L', colorName: 'Ash', colorSwatch: '#aaa69d', amountMinor: 5400, currency: 'USD', available: true },
  ],
  'preview-hat': [
    { id: 'hat-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3400, currency: 'USD', available: true },
    { id: 'hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 3400, currency: 'USD', available: true },
  ],
  'preview-tote': [
    { id: 'tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3600, currency: 'USD', available: true },
    { id: 'tote-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 3600, currency: 'USD', available: true },
  ],
};

export class PreviewCatalogGateway implements CatalogGateway {
  async listVariants(productSlug: string, currency: string): Promise<readonly CatalogVariant[]> {
    if (currency !== 'USD') throw new Error('Preview catalog only supports USD');
    return structuredClone(PREVIEW_VARIANTS[productSlug] ?? []);
  }
}
