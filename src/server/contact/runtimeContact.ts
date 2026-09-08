import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PostgresExperienceRepository } from '@/server/experience/PostgresExperienceRepository';
import { PostgresShippingRepository } from '@/server/shipping/PostgresShippingRepository';
import { ShippingService } from '@/server/shipping/ShippingService';
import { ContactService } from './ContactService';
import { PostgresContactRepository } from './PostgresContactRepository';
import { ResendOtpDeliveryGateway } from './ResendOtpDeliveryGateway';

const OTP_RATE_LIMIT_RETENTION_MS = 48 * 60 * 60 * 1000;
const OTP_RATE_LIMIT_CLEANUP_LIMIT = 5000;

export class ContactRuntimeUnavailableError extends Error {
  constructor(message = 'Contact runtime is not configured') {
    super(message);
    this.name = 'ContactRuntimeUnavailableError';
  }
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new ContactRuntimeUnavailableError('DATABASE_URL is required');
  return value;
}

export function createContactService(): ContactService {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new ContactRuntimeUnavailableError('Transactional email is not configured');
  }

  const sql = createNeonSqlExecutor(databaseUrl());
  return new ContactService(
    new PostgresExperienceRepository(sql),
    new PostgresContactRepository(sql),
    new ResendOtpDeliveryGateway({ apiKey, from }),
  );
}

export function createShippingService(): ShippingService {
  const sql = createNeonSqlExecutor(databaseUrl());
  return new ShippingService(
    new PostgresExperienceRepository(sql),
    new PostgresContactRepository(sql),
    new PostgresShippingRepository(sql),
  );
}

export async function cleanupOtpRateLimits(now: Date = new Date()): Promise<number> {
  const sql = createNeonSqlExecutor(databaseUrl());
  return new PostgresContactRepository(sql).pruneOtpRateLimits({
    olderThan: new Date(now.getTime() - OTP_RATE_LIMIT_RETENTION_MS),
    limit: OTP_RATE_LIMIT_CLEANUP_LIMIT,
  });
}
