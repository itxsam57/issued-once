import { IssuedOnceCatalogGateway } from '@/server/physical/IssuedOnceCatalogGateway';
import { PrintfulVariantMap } from '@/server/manufacturing/PrintfulVariantMap';

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
  blobPing: () => Promise<boolean>;
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

function safeFetchError(response: Response) {
  return `HTTP ${response.status}`;
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

    if (!this.env.DATABASE_URL?.trim()) {
      checks.push({ key: 'database', label: 'Neon database', state: 'missing', detail: 'DATABASE_URL is not configured.' });
    } else {
      try {
        checks.push(await this.dependencies.databasePing()
          ? { key: 'database', label: 'Neon database', state: 'ready', detail: 'Read-only database ping succeeded.' }
          : { key: 'database', label: 'Neon database', state: 'blocked', detail: 'Database ping failed.' });
      } catch {
        checks.push({ key: 'database', label: 'Neon database', state: 'blocked', detail: 'Database ping failed.' });
      }
    }

    const hasPrivacyValues = present(this.env, 'QUIZ_ENCRYPTION_KEY_V1', 'IDENTITY_HMAC_KEY');
    const privacyKeysValid =
      isBase64Key32(this.env.QUIZ_ENCRYPTION_KEY_V1) &&
      isBase64Key32(this.env.IDENTITY_HMAC_KEY);
    checks.push(!hasPrivacyValues
      ? { key: 'privacy', label: 'Privacy keys', state: 'missing', detail: 'Encryption and identity-HMAC keys are required.' }
      : privacyKeysValid
        ? { key: 'privacy', label: 'Privacy keys', state: 'ready', detail: 'Both privacy keys decode to the required 32 bytes.' }
        : { key: 'privacy', label: 'Privacy keys', state: 'blocked', detail: 'Privacy keys are present but do not decode to exactly 32 bytes.' });

    let availableFactoryKeys: string[] = [];
    const catalogJson = this.env.ISSUED_ONCE_CATALOG_JSON?.trim();
    if (!catalogJson) {
      checks.push({ key: 'catalog', label: 'Retail catalog', state: 'missing', detail: 'ISSUED_ONCE_CATALOG_JSON is not configured.' });
    } else {
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
        checks.push({ key: 'catalog', label: 'Retail catalog', state: 'ready', detail: `${availableFactoryKeys.length} sellable logical variant(s) validated in ${currency}.` });
      } catch {
        checks.push({ key: 'catalog', label: 'Retail catalog', state: 'blocked', detail: 'Retail catalog is invalid, uses an unsupported Safepay currency, or is missing a current Issue form.' });
      }
    }

    const safepayEnvironment = this.env.SAFEPAY_ENVIRONMENT?.trim().toLowerCase();
    if (!present(this.env, 'SAFEPAY_API_KEY', 'SAFEPAY_WEBHOOK_SECRET') || !['sandbox', 'production'].includes(safepayEnvironment ?? '')) {
      checks.push({ key: 'safepay', label: 'Safepay', state: 'missing', detail: 'Safepay environment, API key, and webhook secret are required.' });
    } else {
      checks.push({
        key: 'safepay',
        label: 'Safepay',
        state: 'configured',
        detail: safepayEnvironment === 'sandbox'
          ? 'Sandbox credentials are configured; signed payment proof still requires a real sandbox cycle.'
          : 'Production credentials are configured; production payment still requires explicit owner launch proof.',
      });
    }

    if (!present(this.env, 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SUPPORT_INBOX_EMAIL')) {
      checks.push({ key: 'resend', label: 'Resend', state: 'missing', detail: 'Email key, verified sender, and support inbox are required.' });
    } else {
      checks.push({ key: 'resend', label: 'Resend', state: 'configured', detail: 'Email configuration is present; real OTP/delivery proof remains required.' });
    }

    const openAIKey = this.env.OPENAI_API_KEY?.trim();
    const designModel = this.env.OPENAI_DESIGN_MODEL?.trim() || 'gpt-5.6-terra';
    const imageModel = this.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
    if (!openAIKey) {
      checks.push({ key: 'openai', label: 'OpenAI design models', state: 'missing', detail: 'OPENAI_API_KEY is not configured.' });
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

    if (!this.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      checks.push({ key: 'blob', label: 'Private artwork storage', state: 'missing', detail: 'BLOB_READ_WRITE_TOKEN is not configured.' });
    } else {
      try {
        checks.push(await this.dependencies.blobPing()
          ? { key: 'blob', label: 'Private artwork storage', state: 'ready', detail: 'Private Blob signing check succeeded.' }
          : { key: 'blob', label: 'Private artwork storage', state: 'blocked', detail: 'Private Blob signing check failed.' });
      } catch {
        checks.push({ key: 'blob', label: 'Private artwork storage', state: 'blocked', detail: 'Private Blob signing check failed.' });
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

    checks.push({
      key: 'queues',
      label: 'Durable queues',
      state: 'configured',
      detail: 'Design and notification consumers are declared in deployment config; deployed-account registration must still be observed.',
    });

    checks.push(this.env.PRINTFUL_ALLOW_CONFIRM === 'true'
      ? { key: 'factory-confirm', label: 'Factory charge switch', state: 'armed', detail: 'PRINTFUL_ALLOW_CONFIRM is armed. Keep this deliberate and temporary.' }
      : { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Printful production confirmation is disabled by default.' });

    const state = (key: string) => checks.find((check) => check.key === key)?.state;
    const readyForSandbox =
      state('database') === 'ready' &&
      state('privacy') === 'ready' &&
      state('catalog') === 'ready' &&
      state('safepay') === 'configured' &&
      safepayEnvironment === 'sandbox' &&
      state('resend') === 'configured' &&
      state('openai') === 'ready' &&
      state('blob') === 'ready' &&
      state('printful') === 'ready' &&
      state('factory-confirm') === 'safe';

    return {
      checkedAt: new Date().toISOString(),
      checks,
      readyForSandbox,
      // Production still requires observed signed payment/email/queue/factory proofs and an owner launch decision.
      readyForProduction: false,
    };
  }
}
