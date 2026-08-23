import { VercelBlobArtworkAccess } from './VercelBlobArtworkAccess';

export class ArtworkAccessRuntimeUnavailableError extends Error {
  constructor(message = 'Artwork access runtime is not configured') {
    super(message);
    this.name = 'ArtworkAccessRuntimeUnavailableError';
  }
}

export function createArtworkAccess() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new ArtworkAccessRuntimeUnavailableError('BLOB_READ_WRITE_TOKEN is required');
  return new VercelBlobArtworkAccess(token);
}
