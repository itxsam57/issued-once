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
  confirmed: boolean;
  ready: boolean;
  missing: Array<'name' | 'supportEmail' | 'location'>;
  invalid: Array<'name' | 'supportEmail' | 'location' | 'legalEntity'>;
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

const PLACEHOLDER = /\b(?:LOCATION|TBD|TEST|EXAMPLE|PLACEHOLDER)\b/i;

function issuedOnceEmail(value: string | null): string | null {
  const email = validEmail(value);
  if (!email) return null;
  const domain = email.split('@').at(-1)!.toLowerCase();
  return domain === 'issuedonce.shop' || domain.endsWith('.issuedonce.shop') ? email : null;
}

function truthfulText(value: string | null): string | null {
  return value && !PLACEHOLDER.test(value) ? value : null;
}

export function readPublicMerchant(env: PublicEnv = process.env): PublicMerchant {
  const rawName = optional(env.MERCHANT_PUBLIC_NAME);
  const rawEmail = optional(env.MERCHANT_SUPPORT_EMAIL);
  const rawLocation = optional(env.MERCHANT_PUBLIC_LOCATION);
  const rawLegalEntity = optional(env.MERCHANT_LEGAL_ENTITY);
  const name = rawName === 'ISSUED ONCE' ? rawName : null;
  const supportEmail = issuedOnceEmail(rawEmail);
  const supportPhone = optional(env.MERCHANT_SUPPORT_PHONE);
  const location = truthfulText(rawLocation);
  const legalEntity = truthfulText(rawLegalEntity);
  const confirmed = env.MERCHANT_PUBLIC_DETAILS_CONFIRMED?.trim() === 'true';
  const missing: PublicMerchant['missing'] = [];
  if (!rawName) missing.push('name');
  if (!rawEmail) missing.push('supportEmail');
  if (!rawLocation) missing.push('location');
  const invalid: PublicMerchant['invalid'] = [];
  if (rawName && !name) invalid.push('name');
  if (rawEmail && !supportEmail) invalid.push('supportEmail');
  if (rawLocation && !location) invalid.push('location');
  if (rawLegalEntity && !legalEntity) invalid.push('legalEntity');
  return {
    name,
    supportEmail,
    supportPhone,
    location,
    legalEntity,
    confirmed,
    ready: missing.length === 0 && invalid.length === 0 && confirmed,
    missing,
    invalid,
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
