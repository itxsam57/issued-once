import { SignedArtworkAccess } from './SignedArtworkAccess';

export class ArtworkAccessRuntimeUnavailableError extends Error {
  constructor(message = 'Artwork access runtime is not configured') {
    super(message);
    this.name = 'ArtworkAccessRuntimeUnavailableError';
  }
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ArtworkAccessRuntimeUnavailableError(`${name} is required`);
  return value;
}

export function createArtworkAccess(): SignedArtworkAccess {
  return new SignedArtworkAccess(
    env('ARTWORK_SIGNING_KEY'),
    env('APP_ORIGIN'),
  );
}
