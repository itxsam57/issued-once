import type { CatalogGateway, CatalogVariant } from '@/server/physical/CatalogGateway';

const PREVIEW_VARIANTS: Record<string, readonly CatalogVariant[]> = {
  'preview-tee': [
    { id: 'tee-s-bone', size: 'S', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3200, currency: 'USD', available: true },
    { id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 3200, currency: 'USD', available: true },
    { id: 'tee-l-ash', size: 'L', colorName: 'Ash', colorSwatch: '#aaa69d', amountMinor: 3200, currency: 'USD', available: true },
  ],
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
