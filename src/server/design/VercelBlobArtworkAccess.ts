import { issueSignedToken, presignUrl } from '@vercel/blob';

const MAX_READ_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

type IssueSignedToken = typeof issueSignedToken;
type PresignUrl = typeof presignUrl;

export interface ArtworkAccessGateway {
  createReadUrl(canonicalUrl: string, ttlMs: number): Promise<string>;
}

export class VercelBlobArtworkAccess implements ArtworkAccessGateway {
  constructor(
    private readonly token: string,
    private readonly now: () => Date = () => new Date(),
    private readonly issueToken: IssueSignedToken = issueSignedToken,
    private readonly signUrl: PresignUrl = presignUrl,
  ) {
    if (!token.trim()) throw new Error('Vercel Blob token is required');
  }

  async createReadUrl(canonicalUrl: string, ttlMs: number): Promise<string> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_READ_WINDOW_MS) {
      throw new Error('Artwork read window is invalid');
    }

    const url = new URL(canonicalUrl);
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.private.blob.vercel-storage.com')
    ) {
      throw new Error('Artwork must use a private Blob URL');
    }

    const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!pathname) throw new Error('Private Blob pathname is invalid');
    const validUntil = this.now().getTime() + ttlMs;
    const signedToken = await this.issueToken({
      pathname,
      operations: ['get'],
      validUntil,
      token: this.token,
    });
    const signed = await this.signUrl(signedToken, {
      operation: 'get',
      pathname,
      access: 'private',
      validUntil,
      useCache: false,
    });
    const readUrl = new URL(signed.presignedUrl);
    if (
      readUrl.protocol !== 'https:' ||
      !readUrl.hostname.endsWith('.private.blob.vercel-storage.com')
    ) {
      throw new Error('Signed artwork URL is invalid');
    }
    return readUrl.toString();
  }
}
