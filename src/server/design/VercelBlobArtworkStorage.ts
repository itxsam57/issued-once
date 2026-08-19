import { put } from '@vercel/blob';
import type { ArtworkStorageGateway } from './ArtworkStorageGateway';

export class VercelBlobArtworkStorage implements ArtworkStorageGateway {
  constructor(private readonly token: string) {
    if (!token.trim()) throw new Error('Vercel Blob token is required');
  }

  async put(input: {
    issueId: string;
    designJobId: string;
    bytes: Buffer;
    mimeType: 'image/png';
  }) {
    if (!input.bytes.length) throw new Error('Artwork cannot be empty');
    const pathname = `issues/${encodeURIComponent(input.issueId)}/design/${encodeURIComponent(input.designJobId)}.png`;
    const blob = await put(pathname, input.bytes, {
      access: 'private',
      contentType: input.mimeType,
      addRandomSuffix: false,
      allowOverwrite: false,
      token: this.token,
    });
    return { url: blob.url, bytes: input.bytes.length };
  }
}
