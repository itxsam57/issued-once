import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { PrintfulVariantMap, readPrintfulVariantMapJson } from '@/server/manufacturing/PrintfulVariantMap';
import type { ArtworkPrintTemplateResolver } from './ArtworkQualityGate';
import { DesignService } from './DesignService';
import { OpenAIDesignGateway } from './OpenAIDesignGateway';
import { PostgresArtworkStorage } from './PostgresArtworkStorage';
import { PostgresDesignRepository } from './PostgresDesignRepository';

export class DesignRuntimeUnavailableError extends Error {
  constructor(message = 'Design runtime is not configured') {
    super(message);
    this.name = 'DesignRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new DesignRuntimeUnavailableError(`${name} is required`);
  return value;
}

const printTemplateResolver: ArtworkPrintTemplateResolver = {
  resolve(input) {
    const mapping = new PrintfulVariantMap(readPrintfulVariantMapJson(process.env)).resolve(input);
    return {
      ...input,
      placementWidth: mapping.position.width,
      placementHeight: mapping.position.height,
      targetDpi: mapping.printArea.dpi,
    };
  },
};

export function createDesignService(): DesignService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new DesignService(
    new PostgresDesignRepository(sql),
    new OpenAIDesignGateway({
      apiKey: env('OPENAI_API_KEY'),
      interpretationModel: process.env.OPENAI_DESIGN_MODEL,
      imageModel: process.env.OPENAI_IMAGE_MODEL,
    }),
    new PostgresArtworkStorage(sql),
    undefined,
    undefined,
    undefined,
    printTemplateResolver,
  );
}
