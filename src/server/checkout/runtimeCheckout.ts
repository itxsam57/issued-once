import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { getExperienceRepository } from '@/server/experience/runtimeRepository';
import { CheckoutService } from './CheckoutService';
import { CheckoutStartService } from './CheckoutStartService';
import { FourthwallCommerceGateway } from './FourthwallCommerceGateway';
import { PostgresCheckoutQuoteRepository } from './PostgresCheckoutQuoteRepository';

export class CheckoutRuntimeUnavailableError extends Error {
  constructor() {
    super('Checkout runtime is not configured');
    this.name = 'CheckoutRuntimeUnavailableError';
  }
}

export function createCheckoutStartService(): CheckoutStartService {
  const databaseUrl = process.env.DATABASE_URL;
  const storefrontToken = process.env.FOURTHWALL_STOREFRONT_TOKEN;
  const shopDomain = process.env.FOURTHWALL_SHOP_DOMAIN;

  if (!databaseUrl || !storefrontToken || !shopDomain) {
    throw new CheckoutRuntimeUnavailableError();
  }

  const sql = createNeonSqlExecutor(databaseUrl);
  const quoteRepository = new PostgresCheckoutQuoteRepository(sql);
  const commerce = new FourthwallCommerceGateway({
    storefrontToken,
    shopDomain,
  });
  const checkout = new CheckoutService(quoteRepository, commerce);

  return new CheckoutStartService(getExperienceRepository(), checkout);
}
