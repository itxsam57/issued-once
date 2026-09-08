import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import {
  createReferralConversionService,
  referralsAreEnabled,
} from '@/server/referrals/runtimeReferrals';
import { ManufacturingEventService } from './ManufacturingEventService';
import { ManufacturingService } from './ManufacturingService';
import { PostgresManufacturingEventRepository } from './PostgresManufacturingEventRepository';
import { PostgresManufacturingRepository } from './PostgresManufacturingRepository';
import { PrintfulGateway } from './PrintfulGateway';
import { PrintfulVariantMap, readPrintfulVariantMapJson } from './PrintfulVariantMap';
import { PrintfulWebhookVerifier } from './PrintfulWebhookVerifier';

export class ManufacturingRuntimeUnavailableError extends Error {
  constructor(message = 'Manufacturing runtime is not configured') {
    super(message);
    this.name = 'ManufacturingRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ManufacturingRuntimeUnavailableError(`${name} is required`);
  return value;
}

function createPrintfulWebhookVerifier(): PrintfulWebhookVerifier {
  try {
    return new PrintfulWebhookVerifier({
      publicKey: env('PRINTFUL_WEBHOOK_PUBLIC_KEY'),
      secretKeyHex: env('PRINTFUL_WEBHOOK_SECRET_HEX'),
      storeId: env('PRINTFUL_STORE_ID'),
    });
  } catch (error) {
    if (error instanceof ManufacturingRuntimeUnavailableError) throw error;
    throw new ManufacturingRuntimeUnavailableError('Printful webhook runtime configuration is invalid');
  }
}

export function createManufacturingService(): ManufacturingService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ManufacturingService(
    new PostgresManufacturingRepository(sql),
    new PrintfulGateway({
      token: env('PRINTFUL_API_TOKEN'),
      storeId: process.env.PRINTFUL_STORE_ID?.trim() || undefined,
    }),
    new PrintfulVariantMap(readPrintfulVariantMapJson(process.env)),
    new SignedArtworkAccess(env('ARTWORK_SIGNING_KEY'), env('APP_ORIGIN')),
  );
}

export function createManufacturingEventService(): ManufacturingEventService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ManufacturingEventService(
    createPrintfulWebhookVerifier(),
    new PostgresManufacturingEventRepository(sql),
    referralsAreEnabled() ? createReferralConversionService() : undefined,
  );
}
