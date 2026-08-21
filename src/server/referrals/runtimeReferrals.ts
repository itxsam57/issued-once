import { PostgresContactRepository } from '@/server/contact/PostgresContactRepository';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { ResendCustomerEmailGateway } from '@/server/notifications/ResendCustomerEmailGateway';
import { PostgresReferralQuoteRepository } from './PostgresReferralQuoteRepository';
import { PostgresReferralRepository } from './PostgresReferralRepository';
import { ReferralConversionService } from './ReferralConversionService';
import { ReferralNotificationService } from './ReferralNotificationService';
import { ReferralService } from './ReferralService';

export class ReferralRuntimeUnavailableError extends Error {
  constructor(message = 'Referral runtime is not configured') {
    super(message);
    this.name = 'ReferralRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ReferralRuntimeUnavailableError(`${name} is required`);
  return value;
}

export function createReferralService(): ReferralService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ReferralService({
    referrals: new PostgresReferralRepository(sql),
    quotes: new PostgresReferralQuoteRepository(sql),
    contacts: new PostgresContactRepository(sql),
    experiences: new PostgresExperienceRepository(sql),
    signingKey: env('REFERRAL_ATTRIBUTION_SIGNING_KEY'),
  });
}

export function createReferralConversionService(): ReferralConversionService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ReferralConversionService({
    repository: new PostgresReferralRepository(sql),
  });
}

export function createReferralNotificationService(): ReferralNotificationService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ReferralNotificationService(
    new PostgresReferralRepository(sql),
    new ResendCustomerEmailGateway({
      apiKey: env('RESEND_API_KEY'),
      from: env('RESEND_FROM_EMAIL'),
      replyTo: process.env.SUPPORT_REPLY_TO?.trim() || undefined,
    }),
  );
}
