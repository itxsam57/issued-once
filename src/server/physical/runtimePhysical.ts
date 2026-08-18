import { FourthwallCommerceGateway } from '@/server/checkout/FourthwallCommerceGateway';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PreviewCatalogGateway } from '@/server/preview/PreviewCatalogGateway';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';
import { PreviewPhysicalSelectionRepository } from '@/server/preview/PreviewPhysicalSelectionRepository';
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
  if (!teeSlug || !hoodieSlug || !hatSlug) {
    throw new PhysicalRuntimeUnavailableError();
  }

  const dependencies = createProductionDependencies();
  return new ObjectSelectionService({
    ...dependencies,
    productSlugs: {
      tee: teeSlug,
      hoodie: hoodieSlug,
      hat: hatSlug,
    },
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

  return new SizeSelectionService(createProductionDependencies());
}
