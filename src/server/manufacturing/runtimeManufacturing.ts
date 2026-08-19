import { VercelBlobArtworkAccess } from '@/server/design/VercelBlobArtworkAccess';
import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { ManufacturingEventService } from './ManufacturingEventService';
import { ManufacturingService } from './ManufacturingService';
import { PostgresManufacturingEventRepository } from './PostgresManufacturingEventRepository';
import { PostgresManufacturingRepository } from './PostgresManufacturingRepository';
import { PrintfulGateway } from './PrintfulGateway';
import { PrintfulVariantMap } from './PrintfulVariantMap';
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

export function createManufacturingService(): ManufacturingService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  const blobToken = env('BLOB_READ_WRITE_TOKEN');
  return new ManufacturingService(
    new PostgresManufacturingRepository(sql),
    new PrintfulGateway({
      token: env('PRINTFUL_API_TOKEN'),
      storeId: process.env.PRINTFUL_STORE_ID?.trim() || undefined,
    }),
    new PrintfulVariantMap(env('PRINTFUL_VARIANT_MAP_JSON')),
    new VercelBlobArtworkAccess(blobToken),
  );
}

export function createManufacturingEventService(): ManufacturingEventService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new ManufacturingEventService(
    new PrintfulWebhookVerifier({
      publicKey: env('PRINTFUL_WEBHOOK_PUBLIC_KEY'),
      secretKeyHex: env('PRINTFUL_WEBHOOK_SECRET_HEX'),
    }),
    new PostgresManufacturingEventRepository(sql),
  );
}
