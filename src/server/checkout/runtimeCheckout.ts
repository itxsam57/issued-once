import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { CheckoutService } from './CheckoutService';
import { CheckoutStartService } from './CheckoutStartService';
import { FourthwallCommerceGateway } from './FourthwallCommerceGateway';
import { PostgresCheckoutQuoteRepository } from './PostgresCheckoutQuoteRepository';
import { PostgresCheckoutStateRepository } from './PostgresCheckoutStateRepository';

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
  const experienceRepository = new PostgresExperienceRepository(sql);
  const quoteRepository = new PostgresCheckoutQuoteRepository(sql);
  const stateRepository = new PostgresCheckoutStateRepository(sql);
  const commerce = new FourthwallCommerceGateway({
    storefrontToken,
    shopDomain,
  });
  const checkout = new CheckoutService(quoteRepository, commerce);

  return new CheckoutStartService(
    experienceRepository,
    checkout,
    stateRepository,
  );
}
