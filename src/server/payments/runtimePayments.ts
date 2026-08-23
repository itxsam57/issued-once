import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';
import { PostgresCheckoutStateRepository } from '@/server/checkout/PostgresCheckoutStateRepository';
import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PostgresShippingRepository } from '@/server/shipping/PostgresShippingRepository';
import { PaymentService } from './PaymentService';
import { PostgresPaymentRepository } from './PostgresPaymentRepository';
import { SafepayPaymentGateway } from './SafepayPaymentGateway';

export class PaymentRuntimeUnavailableError extends Error {
  constructor(message = 'Payment runtime is not configured') {
    super(message);
    this.name = 'PaymentRuntimeUnavailableError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PaymentRuntimeUnavailableError(`${name} is required`);
  return value;
}

function requireSafepayApiSecret(): string {
  const value = process.env.SAFEPAY_API_SECRET?.trim() || process.env.SAFEPAY_V1_SECRET?.trim();
  if (!value) {
    throw new PaymentRuntimeUnavailableError('SAFEPAY_API_SECRET or SAFEPAY_V1_SECRET is required');
  }
  return value;
}

export function createPaymentService(): PaymentService {
  const environment = process.env.SAFEPAY_ENVIRONMENT?.trim() || 'sandbox';
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new PaymentRuntimeUnavailableError('SAFEPAY_ENVIRONMENT must be sandbox or production');
  }

  const sql = createNeonSqlExecutor(requireEnv('DATABASE_URL'));
  return new PaymentService({
    experiences: new PostgresExperienceRepository(sql),
    quotes: new PostgresCheckoutQuoteRepository(sql),
    contacts: new PostgresContactRepository(sql),
    shipping: new PostgresShippingRepository(sql),
    payments: new PostgresPaymentRepository(sql),
    checkoutStates: new PostgresCheckoutStateRepository(sql),
    gateway: new SafepayPaymentGateway({
      environment,
      apiKey: requireEnv('SAFEPAY_API_KEY'),
      apiSecret: requireSafepayApiSecret(),
      webhookSecret: requireEnv('SAFEPAY_WEBHOOK_SECRET'),
    }),
  });
}
