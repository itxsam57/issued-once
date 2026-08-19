import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PreviewCatalogGateway } from '@/server/preview/PreviewCatalogGateway';
import { PreviewCheckoutQuoteRepository } from '@/server/preview/PreviewCheckoutQuoteRepository';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';
import { PreviewPhysicalSelectionRepository } from '@/server/preview/PreviewPhysicalSelectionRepository';
import { BaseSelectionService } from './BaseSelectionService';
import { ObjectSelectionService } from './ObjectSelectionService';
import { PostgresIssuedOnceCatalogGateway } from './PostgresIssuedOnceCatalogGateway';
import { PostgresPhysicalSelectionRepository } from './PostgresPhysicalSelectionRepository';
import { SizeSelectionService } from './SizeSelectionService';

export class PhysicalRuntimeUnavailableError extends Error {
  constructor(message = 'Physical selection runtime is not configured') {
    super(message);
    this.name = 'PhysicalRuntimeUnavailableError';
  }
}

function createProductionDependencies() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const catalogJson = process.env.ISSUED_ONCE_CATALOG_JSON?.trim();
  if (!databaseUrl || !catalogJson) throw new PhysicalRuntimeUnavailableError();

  const sql = createNeonSqlExecutor(databaseUrl);
  let catalog: PostgresIssuedOnceCatalogGateway;
  try {
    catalog = new PostgresIssuedOnceCatalogGateway(catalogJson, sql);
  } catch (error) {
    throw new PhysicalRuntimeUnavailableError(error instanceof Error ? error.message : 'ISSUED ONCE catalog is invalid');
  }

  return {
    experienceRepository: new PostgresExperienceRepository(sql),
    physicalRepository: new PostgresPhysicalSelectionRepository(sql),
    quoteRepository: new PostgresCheckoutQuoteRepository(sql),
    catalog,
    currency: catalog.currency(),
  };
}

function configuredProductSlugs(catalog: { productSlug(objectType: string): string }) {
  const slugs = {
    tee: catalog.productSlug('tee'),
    hat: catalog.productSlug('hat'),
    tote: catalog.productSlug('tote'),
  } as { tee: string; hat: string; tote: string; hoodie?: string };
  try { slugs.hoodie = catalog.productSlug('hoodie'); } catch { /* seasonal */ }
  return slugs;
}

export function createObjectSelectionService(): ObjectSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new ObjectSelectionService({
      experienceRepository: new PreviewExperienceRepository(),
      physicalRepository: new PreviewPhysicalSelectionRepository(),
      catalog: new PreviewCatalogGateway(),
      productSlugs: { tee: 'preview-tee', hoodie: 'preview-hoodie', hat: 'preview-hat', tote: 'preview-tote' },
      currency: 'USD',
    });
  }
  const dependencies = createProductionDependencies();
  return new ObjectSelectionService({
    experienceRepository: dependencies.experienceRepository,
    physicalRepository: dependencies.physicalRepository,
    catalog: dependencies.catalog,
    productSlugs: configuredProductSlugs(dependencies.catalog),
    currency: dependencies.currency,
  });
}

export function createSizeSelectionService(): SizeSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new SizeSelectionService({ experienceRepository: new PreviewExperienceRepository(), physicalRepository: new PreviewPhysicalSelectionRepository(), catalog: new PreviewCatalogGateway(), currency: 'USD' });
  }
  const dependencies = createProductionDependencies();
  return new SizeSelectionService({ experienceRepository: dependencies.experienceRepository, physicalRepository: dependencies.physicalRepository, catalog: dependencies.catalog, currency: dependencies.currency });
}

export function createBaseSelectionService(): BaseSelectionService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new BaseSelectionService({ experienceRepository: new PreviewExperienceRepository(), physicalRepository: new PreviewPhysicalSelectionRepository(), quoteRepository: new PreviewCheckoutQuoteRepository(), catalog: new PreviewCatalogGateway(), currency: 'USD' });
  }
  return new BaseSelectionService(createProductionDependencies());
}
