import { readPublicMerchant } from '@/brand/publicMerchant';
import { PrintfulVariantMap } from '@/server/manufacturing/PrintfulVariantMap';
import {
  readSafepayRuntimeConfig,
  SafepayConfigurationError,
  type SafepayEnvironment,
} from '@/server/payments/safepayRuntimeConfig';
import { IssuedOnceCatalogGateway } from '@/server/physical/IssuedOnceCatalogGateway';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';

export type ReadinessState = 'ready' | 'configured' | 'missing' | 'blocked' | 'safe' | 'armed';

export type ReadinessCheck = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
};

type Dependencies = {
  env?: NodeJS.ProcessEnv;
  databasePing: () => Promise<boolean>;
  catalogAuthorityPing: () => Promise<boolean>;
  storagePing: () => Promise<boolean>;
  queuePing: () => Promise<boolean>;
  legacyPrivacyPayloadsExist?: () => Promise<boolean>;
  privacySchemaPing?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
};

function present(env: NodeJS.ProcessEnv, ...names: string[]) {
  return names.every((name) => Boolean(env[name]?.trim()));
}

function isBase64Key32(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    return Buffer.from(value.trim(), 'base64').length === 32;
  } catch {
    return false;
  }
}

function isValidHexSecret(value: string | undefined) {
  const secret = value?.trim() ?? '';
  if (!/^[0-9a-f]+$/i.test(secret) || secret.length % 2 !== 0) return false;
  return Buffer.from(secret, 'hex').length > 0;
}

function hasSafeSecret(value: string | undefined) {
  return (value?.trim().length ?? 0) >= 24;
}

function hasHttpsOrigin(value: string | undefined) {
  try {
    return new URL(value?.trim() ?? '').protocol === 'https:';
  } catch {
    return false;
  }
}

function safeFetchError(response: Response) {
  return `HTTP ${response.status}`;
}

function safepayReadinessFailure(error: SafepayConfigurationError): ReadinessCheck {
  const invalid = error.code === 'INVALID_ENVIRONMENT';
  return {
    key: 'safepay',
    label: 'Safepay',
    state: invalid ? 'blocked' : 'missing',
    detail: error.code === 'MISSING_API_SECRET'
      ? 'Safepay API secret is required (SAFEPAY_API_SECRET or SAFEPAY_V1_SECRET).'
      : error.code === 'MISSING_API_KEY'
        ? 'Safepay API key is required.'
        : error.code === 'MISSING_WEBHOOK_SECRET'
          ? 'Safepay webhook secret is required.'
          : error.code === 'MISSING_ENVIRONMENT'
            ? 'Safepay environment is required.'
            : 'Safepay environment must be sandbox or production.',
  };
}

export class ReadinessService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: Dependencies) {
    this.env = dependencies.env ?? process.env;
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async check(): Promise<{
    checkedAt: string;
    checks: ReadinessCheck[];
    readyForSandbox: boolean;
    readyForProduction: false;
  }> {
    const checks: ReadinessCheck[] = [];

    let databaseReady = false;
    if (!this.env.DATABASE_URL?.trim()) {
      checks.push({ key: 'database', label: 'Neon database', state: 'missing', detail: 'DATABASE_URL is not configured.' });
    } else {
      try {
        databaseReady = await this.dependencies.databasePing();
        checks.push(databaseReady
          ? { key: 'database', label: 'Neon database', state: 'ready', detail: 'Read-only database ping succeeded.' }
          : { key: 'database', label: 'Neon database', state: 'blocked', detail: 'Database ping failed.' });
      } catch {
        checks.push({ key: 'database', label: 'Neon database', state: 'blocked', detail: 'Database ping failed.' });
      }
    }

    let legacyPrivacyPayloadsExist = true;
    let privacySchemaReady = true;
    let privacyEvidenceReady = true;
    try {
      if (this.dependencies.legacyPrivacyPayloadsExist) {
        legacyPrivacyPayloadsExist = await this.dependencies.legacyPrivacyPayloadsExist();
      }
      if (this.dependencies.privacySchemaPing) {
        privacySchemaReady = await this.dependencies.privacySchemaPing();
      }
    } catch {
      privacyEvidenceReady = false;
    }

    const requiredPrivacyKeys = legacyPrivacyPayloadsExist
      ? ['QUIZ_ENCRYPTION_KEY_V1', 'QUIZ_ENCRYPTION_KEY_V2', 'IDENTITY_HMAC_KEY']
      : ['QUIZ_ENCRYPTION_KEY_V2', 'IDENTITY_HMAC_KEY'];
    const hasPrivacyValues = present(this.env, ...requiredPrivacyKeys);
    const privacyKeysValid = requiredPrivacyKeys.every((name) => isBase64Key32(this.env[name]));
    const privacyKeyLabel = legacyPrivacyPayloadsExist ? 'V1/V2 encryption keys' : 'V2 encryption key';

    checks.push(!privacyEvidenceReady
      ? {
          key: 'privacy',
          label: 'Privacy keys',
          state: 'blocked',
          detail: 'Legacy privacy-key usage or V2 design-brief schema could not be verified.',
        }
      : !privacySchemaReady
        ? {
            key: 'privacy',
            label: 'Privacy keys',
            state: 'blocked',
            detail: 'Database privacy schema does not yet accept current V2 design briefs.',
          }
        : !hasPrivacyValues
          ? {
              key: 'privacy',
              label: 'Privacy keys',
              state: 'missing',
              detail: legacyPrivacyPayloadsExist
                ? 'V1 and V2 encryption keys plus the identity-HMAC key are required while legacy V1 payloads remain.'
                : 'V2 encryption key plus the identity-HMAC key are required.',
            }
          : privacyKeysValid
            ? {
                key: 'privacy',
                label: 'Privacy keys',
                state: 'ready',
                detail: `${privacyKeyLabel} and the identity-HMAC key decode to the required 32 bytes.`,
              }
            : {
                key: 'privacy',
                label: 'Privacy keys',
                state: 'blocked',
                detail: `${privacyKeyLabel} and the identity-HMAC key must each decode to exactly 32 bytes.`,
              });

    const merchant = readPublicMerchant(this.env);
    checks.push(merchant.ready
      ? {
          key: 'merchant',
          label: 'Public merchant disclosure',
          state: 'ready',
          detail: 'Required public merchant identity, support and location disclosures are configured.',
        }
      : {
          key: 'merchant',
          label: 'Public merchant disclosure',
          state: 'missing',
          detail: 'Required public merchant identity, support or location disclosure is incomplete.',
        });

    let availableFactoryKeys: string[] = [];
    const configuredCatalogJson = this.env.ISSUED_ONCE_CATALOG_JSON?.trim();
    const usesBootCatalog = !configuredCatalogJson;
    const catalogJson = configuredCatalogJson || ISSUED_ONCE_BOOT_CATALOG_JSON;
    try {
      const catalog = new IssuedOnceCatalogGateway(catalogJson);
      const currency = catalog.currency();
      if (!['USD', 'PKR'].includes(currency)) {
        throw new Error('Retail catalog currency is unsupported by Safepay');
      }
      for (const objectType of ['tee', 'hat', 'tote']) catalog.productSlug(objectType);
      const parsed = JSON.parse(catalogJson) as {
        products?: Record<string, { variants?: Array<{ size?: string; colorName?: string; available?: boolean }> }>;
      };
      availableFactoryKeys = Object.entries(parsed.products ?? {}).flatMap(([objectType, product]) =>
        (product.variants ?? [])
          .filter((variant) => variant.available !== false && variant.size && variant.colorName)
          .map((variant) => `${objectType}:${variant.size}:${variant.colorName}`),
      );
      checks.push({
        key: 'catalog',
        label: 'Retail catalog',
        state: 'ready',
        detail: usesBootCatalog
          ? `Audited boot catalog: ${availableFactoryKeys.length} sellable logical variant(s) validated in ${currency}.`
          : `${availableFactoryKeys.length} sellable logical variant(s) validated in ${currency}.`,
      });
    } catch {
      checks.push({ key: 'catalog', label: 'Retail catalog', state: 'blocked', detail: 'Retail catalog is invalid, uses an unsupported Safepay currency, or is missing a current Issue form.' });
    }

    try {
      const catalogAuthorityReady = await this.dependencies.catalogAuthorityPing();
      checks.push(catalogAuthorityReady
        ? {
            key: 'catalog-authority',
            label: 'Catalog authority',
            state: 'ready',
            detail: 'An owner-published ACTIVE catalog is authoritative for commerce.',
          }
        : {
            key: 'catalog-authority',
            label: 'Catalog authority',
            state: 'missing',
            detail: 'No owner-published ACTIVE catalog is available for commerce.',
          });
    } catch {
      checks.push({
        key: 'catalog-authority',
        label: 'Catalog authority',
        state: 'blocked',
        detail: 'Owner-published ACTIVE catalog authority could not be verified.',
      });
    }

    let safepayEnvironment: SafepayEnvironment | null = null;
    try {
      const safepay = readSafepayRuntimeConfig(this.env, { requireExplicitEnvironment: true });
      safepayEnvironment = safepay.environment;
      checks.push({
        key: 'safepay',
        label: 'Safepay',
        state: 'configured',
        detail: safepay.environment === 'sandbox'
          ? 'Sandbox credentials are configured; signed payment proof still requires a real sandbox cycle.'
          : 'Production credentials are configured; production payment still requires explicit owner launch proof.',
      });
    } catch (error) {
      checks.push(error instanceof SafepayConfigurationError
        ? safepayReadinessFailure(error)
        : { key: 'safepay', label: 'Safepay', state: 'blocked', detail: 'Safepay configuration could not be validated.' });
    }

    if (!present(this.env, 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SUPPORT_INBOX_EMAIL')) {
      checks.push({ key: 'resend', label: 'Resend', state: 'missing', detail: 'Email key, verified sender, and support inbox are required.' });
    } else {
      checks.push({ key: 'resend', label: 'Resend', state: 'configured', detail: 'Email configuration is present; real OTP/delivery proof remains required.' });
    }

    const openAIKey = this.env.OPENAI_API_KEY?.trim();
    const designModel = this.env.OPENAI_DESIGN_MODEL?.trim() || 'gpt-5.6-terra';
    const imageModel = this.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1.5';
    if (!openAIKey) {
      checks.push({ key: 'openai', label: 'OpenAI design models', state: 'missing', detail: 'OPENAI_API_KEY is not configured.' });
    } else if (/^gpt-image-2(?:$|-)/i.test(imageModel)) {
      checks.push({
        key: 'openai',
        label: 'OpenAI design models',
        state: 'blocked',
        detail: 'GPT Image 2 cannot satisfy the transparent production artwork contract.',
      });
    } else {
      try {
        const modelResponses = await Promise.all([designModel, imageModel].map((model) =>
          this.fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${openAIKey}` },
            cache: 'no-store',
          }),
        ));
        const failed = modelResponses.find((response) => !response.ok);
        checks.push(failed
          ? { key: 'openai', label: 'OpenAI design models', state: 'blocked', detail: `Configured model access check failed (${safeFetchError(failed)}).` }
          : { key: 'openai', label: 'OpenAI design models', state: 'ready', detail: `${designModel} and ${imageModel} are accessible to this deployment.` });
      } catch {
        checks.push({ key: 'openai', label: 'OpenAI design models', state: 'blocked', detail: 'Configured model access check could not complete.' });
      }
    }

    const storageConfigured = present(this.env, 'DATABASE_URL', 'ARTWORK_SIGNING_KEY', 'APP_ORIGIN');
    const storageConfigSafe = hasSafeSecret(this.env.ARTWORK_SIGNING_KEY) && hasHttpsOrigin(this.env.APP_ORIGIN);
    if (!storageConfigured) {
      checks.push({ key: 'storage', label: 'Private artwork storage', state: 'missing', detail: 'Database authority, artwork signing key, and HTTPS application origin are required.' });
    } else if (!storageConfigSafe) {
      checks.push({ key: 'storage', label: 'Private artwork storage', state: 'blocked', detail: 'Private artwork signing or application-origin configuration is unsafe.' });
    } else {
      try {
        checks.push(await this.dependencies.storagePing()
          ? { key: 'storage', label: 'Private artwork storage', state: 'ready', detail: 'Durable private artwork database boundary is available.' }
          : { key: 'storage', label: 'Private artwork storage', state: 'blocked', detail: 'Durable private artwork database boundary is unavailable.' });
      } catch {
        checks.push({ key: 'storage', label: 'Private artwork storage', state: 'blocked', detail: 'Durable private artwork database boundary is unavailable.' });
      }
    }

    const printfulConfigured = present(
      this.env,
      'PRINTFUL_API_TOKEN',
      'PRINTFUL_VARIANT_MAP_JSON',
      'PRINTFUL_WEBHOOK_PUBLIC_KEY',
      'PRINTFUL_WEBHOOK_SECRET_HEX',
    );
    if (!printfulConfigured) {
      checks.push({ key: 'printful', label: 'Printful', state: 'missing', detail: 'Printful API, mapping, and signed-webhook configuration are required.' });
    } else if (!isValidHexSecret(this.env.PRINTFUL_WEBHOOK_SECRET_HEX)) {
      checks.push({ key: 'printful', label: 'Printful', state: 'blocked', detail: 'Printful webhook secret must be non-empty, even-length hexadecimal.' });
    } else {
      try {
        const map = new PrintfulVariantMap(this.env.PRINTFUL_VARIANT_MAP_JSON!);
        for (const key of availableFactoryKeys) {
          const [objectType, sizeCode, ...colorParts] = key.split(':');
          map.resolve({ objectType, sizeCode, colorCode: colorParts.join(':') });
        }
        const response = await this.fetchImpl('https://api.printful.com/stores', {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.env.PRINTFUL_API_TOKEN!.trim()}` },
          cache: 'no-store',
        });
        if (!response.ok) {
          checks.push({ key: 'printful', label: 'Printful', state: 'blocked', detail: `Printful account access failed (${safeFetchError(response)}).` });
        } else {
          const body = await response.json() as { result?: Array<{ id?: number | string }> };
          const storeId = this.env.PRINTFUL_STORE_ID?.trim();
          const storeFound = !storeId || (body.result ?? []).some((store) => String(store.id) === storeId);
          checks.push(storeFound
            ? { key: 'printful', label: 'Printful', state: 'ready', detail: `Account access and ${availableFactoryKeys.length} sellable placement mapping(s) validated.` }
            : { key: 'printful', label: 'Printful', state: 'blocked', detail: 'Configured Printful store ID is not visible to this token.' });
        }
      } catch {
        checks.push({ key: 'printful', label: 'Printful', state: 'blocked', detail: 'Printful mapping or account access is invalid.' });
      }
    }

    if (!hasSafeSecret(this.env.CRON_SECRET)) {
      checks.push({ key: 'queues', label: 'Durable jobs', state: 'missing', detail: 'A protected cron secret is required to drain durable background jobs.' });
    } else if (!databaseReady) {
      checks.push({ key: 'queues', label: 'Durable jobs', state: 'blocked', detail: 'Durable jobs require a healthy database.' });
    } else {
      try {
        checks.push(await this.dependencies.queuePing()
          ? { key: 'queues', label: 'Durable jobs', state: 'ready', detail: 'Postgres background-job schema is present and the protected drain is configured.' }
          : { key: 'queues', label: 'Durable jobs', state: 'blocked', detail: 'Postgres background-job schema is unavailable.' });
      } catch {
        checks.push({ key: 'queues', label: 'Durable jobs', state: 'blocked', detail: 'Postgres background-job schema is unavailable.' });
      }
    }

    checks.push(this.env.PRINTFUL_ALLOW_CONFIRM === 'true'
      ? { key: 'factory-confirm', label: 'Factory charge switch', state: 'armed', detail: 'PRINTFUL_ALLOW_CONFIRM is armed. Keep this deliberate and temporary.' }
      : { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Printful production confirmation is disabled by default.' });

    const state = (key: string) => checks.find((check) => check.key === key)?.state;
    const readyForSandbox =
      state('database') === 'ready' &&
      state('privacy') === 'ready' &&
      state('merchant') === 'ready' &&
      state('catalog') === 'ready' &&
      state('catalog-authority') === 'ready' &&
      state('safepay') === 'configured' &&
      safepayEnvironment === 'sandbox' &&
      state('resend') === 'configured' &&
      state('openai') === 'ready' &&
      state('storage') === 'ready' &&
      state('printful') === 'ready' &&
      state('queues') === 'ready' &&
      state('factory-confirm') === 'safe';

    return {
      checkedAt: new Date().toISOString(),
      checks,
      readyForSandbox,
      // Production still requires observed signed payment/email/job/factory proofs and an owner launch decision.
      readyForProduction: false,
    };
  }
}
