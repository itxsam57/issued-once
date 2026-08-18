import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { ManufacturingService } from './ManufacturingService';
import { PostgresManufacturingRepository } from './PostgresManufacturingRepository';
import { PrintfulGateway } from './PrintfulGateway';
import { PrintfulVariantMap } from './PrintfulVariantMap';

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
  return new ManufacturingService(
    new PostgresManufacturingRepository(sql),
    new PrintfulGateway({
      token: env('PRINTFUL_API_TOKEN'),
      storeId: process.env.PRINTFUL_STORE_ID?.trim() || undefined,
    }),
    new PrintfulVariantMap(env('PRINTFUL_VARIANT_MAP_JSON')),
  );
}
