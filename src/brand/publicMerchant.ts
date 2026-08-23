import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';
import { IssuedOnceCatalogGateway } from '@/server/physical/IssuedOnceCatalogGateway';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';

type PublicEnv = Record<string, string | undefined>;
type SqlExecutor = ReturnType<typeof createNeonSqlExecutor>;

export type PublicMerchant = {
  name: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  location: string | null;
  legalEntity: string | null;
  ready: boolean;
  missing: Array<'name' | 'supportEmail' | 'location'>;
};

export type PublicCatalogProduct = {
  objectType: 'tee' | 'hat' | 'tote';
  productSlug: string;
  startingAmountMinor: number;
  sellableVariants: number;
};

export type PublicCatalogSummary = {
  currency: string;
  products: PublicCatalogProduct[];
};

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validEmail(value: string | null): string | null {
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function readPublicMerchant(env: PublicEnv = process.env): PublicMerchant {
  const name = optional(env.MERCHANT_PUBLIC_NAME);
  const supportEmail = validEmail(optional(env.MERCHANT_SUPPORT_EMAIL));
  const supportPhone = optional(env.MERCHANT_SUPPORT_PHONE);
  const location = optional(env.MERCHANT_PUBLIC_LOCATION);
  const legalEntity = optional(env.MERCHANT_LEGAL_ENTITY);
  const missing: PublicMerchant['missing'] = [];
  if (!name) missing.push('name');
  if (!supportEmail) missing.push('supportEmail');
  if (!location) missing.push('location');
  return {
    name,
    supportEmail,
    supportPhone,
    location,
    legalEntity,
    ready: missing.length === 0,
    missing,
  };
}

export async function getPublicCatalogSummary({
  env = process.env,
  sql,
}: {
  env?: PublicEnv;
  sql?: SqlExecutor;
} = {}): Promise<PublicCatalogSummary> {
  const fallbackJson = optional(env.ISSUED_ONCE_CATALOG_JSON) ?? ISSUED_ONCE_BOOT_CATALOG_JSON;
  const databaseUrl = optional(env.DATABASE_URL);
  const catalog = databaseUrl
    ? new PostgresIssuedOnceCatalogGateway(fallbackJson, sql ?? createNeonSqlExecutor(databaseUrl))
    : new IssuedOnceCatalogGateway(fallbackJson);
  const currency = catalog.currency();
  const products: PublicCatalogProduct[] = [];

  for (const objectType of ['tee', 'hat', 'tote'] as const) {
    let productSlug: string;
    try {
      productSlug = catalog.productSlug(objectType);
    } catch {
      continue;
    }
    const variants = await catalog.listVariants(productSlug, currency);
    const sellable = variants.filter((variant) => variant.available);
    if (sellable.length === 0) continue;
    products.push({
      objectType,
      productSlug,
      startingAmountMinor: Math.min(...sellable.map((variant) => variant.amountMinor)),
      sellableVariants: sellable.length,
    });
  }

  return { currency, products };
}

export function formatPublicMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
