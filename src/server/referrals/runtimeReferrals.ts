import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PostgresReferralQuoteRepository } from './PostgresReferralQuoteRepository';
import { PostgresReferralRepository } from './PostgresReferralRepository';
import { ReferralService } from './ReferralService';

export class ReferralRuntimeUnavailableError extends Error {
  constructor(message = 'Referral runtime is not configured') {
    super(message);
    this.name = 'ReferralRuntimeUnavailableError';
  }
}

export function createReferralService(): ReferralService {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const signingKey = process.env.REFERRAL_ATTRIBUTION_SIGNING_KEY?.trim();
  if (!databaseUrl || !signingKey) throw new ReferralRuntimeUnavailableError();

  const sql = createNeonSqlExecutor(databaseUrl);
  return new ReferralService({
    referrals: new PostgresReferralRepository(sql),
    quotes: new PostgresReferralQuoteRepository(sql),
    contacts: new PostgresContactRepository(sql),
    experiences: new PostgresExperienceRepository(sql),
    signingKey,
  });
}
