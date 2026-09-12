import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PreviewCatalogGateway } from '@/server/preview/PreviewCatalogGateway';
import { PreviewCheckoutQuoteRepository } from '@/server/preview/PreviewCheckoutQuoteRepository';
import { PreviewExperienceRepository } from '@/server/preview/PreviewExperienceRepository';
import { PreviewPhysicalSelectionRepository } from '@/server/preview/PreviewPhysicalSelectionRepository';
import { ISSUED_ONCE_BOOT_CATALOG_JSON } from '@/server/physical/bootCatalog';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';
import { PostgresPhysicalSelectionRepository } from '@/server/physical/PostgresPhysicalSelectionRepository';
import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';
import { PostgresReferralQuoteRepository } from '@/server/referrals/PostgresReferralQuoteRepository';
import { referralsAreEnabled } from '@/server/referrals/runtimeReferrals';
import { PostgresShippingRepository } from '@/server/shipping/PostgresShippingRepository';
import { ExperienceResumeService } from './ExperienceResumeService';

export class ExperienceResumeRuntimeUnavailableError extends Error {
  constructor(message = 'Experience resume runtime is not configured') {
    super(message);
    this.name = 'ExperienceResumeRuntimeUnavailableError';
  }
}

export function createExperienceResumeService(): ExperienceResumeService {
  if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
    return new ExperienceResumeService({
      experiences: new PreviewExperienceRepository(),
      physical: new PreviewPhysicalSelectionRepository(),
      quotes: new PreviewCheckoutQuoteRepository(),
      contacts: { findVerifiedByExperienceId: async () => null },
      shipping: { findByExperienceId: async () => null },
      catalog: new PreviewCatalogGateway(),
      currency: 'USD',
    });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new ExperienceResumeRuntimeUnavailableError('DATABASE_URL is required');

  const sql = createNeonSqlExecutor(databaseUrl);
  const catalogJson = process.env.ISSUED_ONCE_CATALOG_JSON?.trim() || ISSUED_ONCE_BOOT_CATALOG_JSON;
  let catalog: PostgresIssuedOnceCatalogGateway;
  try {
    catalog = new PostgresIssuedOnceCatalogGateway(catalogJson, sql);
  } catch (error) {
    throw new ExperienceResumeRuntimeUnavailableError(
      error instanceof Error ? error.message : 'ISSUED ONCE catalog is invalid',
    );
  }

  return new ExperienceResumeService({
    experiences: new PostgresExperienceRepository(sql),
    physical: new PostgresPhysicalSelectionRepository(sql),
    quotes: referralsAreEnabled()
      ? new PostgresReferralQuoteRepository(sql)
      : new PostgresCheckoutQuoteRepository(sql),
    contacts: new PostgresContactRepository(sql),
    shipping: new PostgresShippingRepository(sql),
    catalog,
    currency: catalog.currency(),
  });
}
