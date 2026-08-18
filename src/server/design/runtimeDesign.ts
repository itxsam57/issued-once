import { createNeonSqlExecutor } from '@/server/experience/NeonSqlExecutor';
import { DesignService } from './DesignService';
import { OpenAIDesignGateway } from './OpenAIDesignGateway';
import { PostgresDesignRepository } from './PostgresDesignRepository';
import { VercelBlobArtworkStorage } from './VercelBlobArtworkStorage';

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

export function createDesignService(): DesignService {
  const sql = createNeonSqlExecutor(env('DATABASE_URL'));
  return new DesignService(
    new PostgresDesignRepository(sql),
    new OpenAIDesignGateway({
      apiKey: env('OPENAI_API_KEY'),
      interpretationModel: process.env.OPENAI_DESIGN_MODEL,
      imageModel: process.env.OPENAI_IMAGE_MODEL,
    }),
    new VercelBlobArtworkStorage(env('BLOB_READ_WRITE_TOKEN')),
  );
}
