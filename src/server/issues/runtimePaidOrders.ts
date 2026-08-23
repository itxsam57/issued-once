import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PaidOrderWebhookService } from './PaidOrderWebhookService';
import { PostgresPaidOrderRepository } from './PostgresPaidOrderRepository';

export class PaidOrderRuntimeUnavailableError extends Error {
  constructor() {
    super('Paid-order runtime is not configured');
    this.name = 'PaidOrderRuntimeUnavailableError';
  }
}

export type PaidOrderRuntime = {
  service: PaidOrderWebhookService;
  webhookSecret: string;
  shopId: string;
  apiVersion: 'V1';
};

export function createPaidOrderRuntime(): PaidOrderRuntime {
  const databaseUrl = process.env.DATABASE_URL;
  const webhookSecret = process.env.FOURTHWALL_WEBHOOK_SECRET;
  const shopId = process.env.FOURTHWALL_SHOP_ID;

  if (!databaseUrl || !webhookSecret || !shopId) {
    throw new PaidOrderRuntimeUnavailableError();
  }

  const sql = createNeonSqlExecutor(databaseUrl);
  const repository = new PostgresPaidOrderRepository(sql);
  const quoteRepository = new PostgresCheckoutQuoteRepository(sql);

  return {
    service: new PaidOrderWebhookService({
      repository,
      quoteRepository,
    }),
    webhookSecret,
    shopId,
    apiVersion: 'V1',
  };
}
