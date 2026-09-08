import { PrintfulCatalogInspector } from './PrintfulCatalogInspector';

export function createPrintfulCatalogInspector() {
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) throw new Error('Printful API token is required');
  return new PrintfulCatalogInspector({
    token,
    storeId: process.env.PRINTFUL_STORE_ID?.trim() || undefined,
  });
}
