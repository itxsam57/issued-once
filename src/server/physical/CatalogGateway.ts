export type CatalogVariant = {
  id: string;
  size: string;
  colorName: string;
  colorSwatch: string | null;
  amountMinor: number;
  currency: string;
  available: boolean;
};

export interface CatalogGateway {
  listVariants(productSlug: string, currency: string): Promise<readonly CatalogVariant[]>;
}
