export type SafepayEnvironment = 'sandbox' | 'production';

export type SafepayRuntimeConfig = {
  environment: SafepayEnvironment;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
};

export type SafepayConfigurationErrorCode =
  | 'MISSING_ENVIRONMENT'
  | 'INVALID_ENVIRONMENT'
  | 'MISSING_API_KEY'
  | 'MISSING_API_SECRET'
  | 'MISSING_WEBHOOK_SECRET';

export class SafepayConfigurationError extends Error {
  constructor(
    readonly code: SafepayConfigurationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SafepayConfigurationError';
  }
}

function required(value: string | undefined, code: SafepayConfigurationErrorCode, message: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new SafepayConfigurationError(code, message);
  return trimmed;
}

export function readSafepayRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { requireExplicitEnvironment?: boolean } = {},
): SafepayRuntimeConfig {
  const configuredEnvironment = env.SAFEPAY_ENVIRONMENT?.trim().toLowerCase();
  if (!configuredEnvironment && options.requireExplicitEnvironment) {
    throw new SafepayConfigurationError(
      'MISSING_ENVIRONMENT',
      'SAFEPAY_ENVIRONMENT is required',
    );
  }

  const environment = configuredEnvironment || 'sandbox';
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new SafepayConfigurationError(
      'INVALID_ENVIRONMENT',
      'SAFEPAY_ENVIRONMENT must be sandbox or production',
    );
  }

  const apiSecret = env.SAFEPAY_API_SECRET?.trim() || env.SAFEPAY_V1_SECRET?.trim();
  if (!apiSecret) {
    throw new SafepayConfigurationError(
      'MISSING_API_SECRET',
      'SAFEPAY_API_SECRET or SAFEPAY_V1_SECRET is required',
    );
  }

  return {
    environment,
    apiKey: required(env.SAFEPAY_API_KEY, 'MISSING_API_KEY', 'SAFEPAY_API_KEY is required'),
    apiSecret,
    webhookSecret: required(
      env.SAFEPAY_WEBHOOK_SECRET,
      'MISSING_WEBHOOK_SECRET',
      'SAFEPAY_WEBHOOK_SECRET is required',
    ),
  };
}
