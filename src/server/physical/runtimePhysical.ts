import { FourthwallCommerceGateway } from '@/server/checkout/FourthwallCommerceGateway';
import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PreviewCatalogGateway } from '@/server/preview/PreviewCatalogGateway';
import { PreviewCheckoutQuoteRepository } from '@/server/preview/PreviewCheckoutQuoteRepository';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';
import { PreviewPhysicalSelectionRepository } from '@/server/preview/PreviewPhysicalSelectionRepository';
import { BaseSelectionService } from './BaseSelectionService';
import { ObjectSelectionService } from './ObjectSelectionService';
import { PostgresPhysicalSelectionRepository } from './PostgresPhysicalSelectionRepository';
import { SizeSelectionService } from './SizeSelectionService';

export class PhysicalRuntimeUnavailableError extends Error {
  constructor() {
    super('Physical selection runtime is not configured');
    this.name = 'PhysicalRuntimeUnavailableError';
  }
}

function createProductionDependencies() {
  const databaseUrl = process.env.DATABASE_URL;
  const storefrontToken = process.env.FOURTHWALL_STOREFRONT_TOKEN;
  const shopDomain = process.env.FOURTHWALL_SHOP_DOMAIN;
  const currency = process.env.FOURTHWALL_CURRENCY?.trim() || 'USD';

  if (!databaseUrl || !storefrontToken || !shopDomain) {
    throw new PhysicalRuntimeUnavailableError();
  }

  const sql = createNeonSqlExecutor(databaseUrl);
  return {
    experienceRepository: new PostgresExperienceRepository(sql),
    physicalRepository: new PostgresPhysicalSelectionRepository(sql),
    quoteRepository: new PostgresCheckoutQuoteRepository(sql),
    catalog: new FourthwallCommerceGateway({ storefrontToken, shopDomain }),
    currency,
  };
}

export function createObjectSelectionService(): ObjectSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new ObjectSelectionService({
      experienceRepository: new PreviewExperienceRepository(),
      physicalRepository: new PreviewPhysicalSelectionRepository(),
      catalog: new PreviewCatalogGateway(),
      productSlugs: {
        tee: 'preview-tee',
        hoodie: 'preview-hoodie',
        hat: 'preview-hat',
      },
      currency: 'USD',
    });
  }

  const teeSlug = process.env.FOURTHWALL_TEE_SLUG;
  const hoodieSlug = process.env.FOURTHWALL_HOODIE_SLUG;
  const hatSlug = process.env.FOURTHWALL_HAT_SLUG;
  if (!teeSlug || !hoodieSlug || !hatSlug) throw new PhysicalRuntimeUnavailableError();

  const dependencies = createProductionDependencies();
  return new ObjectSelectionService({
    experienceRepository: dependencies.experienceRepository,
    physicalRepository: dependencies.physicalRepository,
    catalog: dependencies.catalog,
    productSlugs: { tee: teeSlug, hoodie: hoodieSlug, hat: hatSlug },
    currency: dependencies.currency,
  });
}

export function createSizeSelectionService(): SizeSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new SizeSelectionService({
      experienceRepository: new PreviewExperienceRepository(),
      physicalRepository: new PreviewPhysicalSelectionRepository(),
      catalog: new PreviewCatalogGateway(),
      currency: 'USD',
    });
  }

  const dependencies = createProductionDependencies();
  return new SizeSelectionService({
    experienceRepository: dependencies.experienceRepository,
    physicalRepository: dependencies.physicalRepository,
    catalog: dependencies.catalog,
    currency: dependencies.currency,
  });
}

export function createBaseSelectionService(): BaseSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new BaseSelectionService({
      experienceRepository: new PreviewExperienceRepository(),
      physicalRepository: new PreviewPhysicalSelectionRepository(),
      quoteRepository: new PreviewCheckoutQuoteRepository(),
      catalog: new PreviewCatalogGateway(),
      currency: 'USD',
    });
  }

  return new BaseSelectionService(createProductionDependencies());
}
