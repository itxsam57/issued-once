import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_READ_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
const SAFE_SEGMENT = /^[A-Za-z0-9._:-]+$/;

export interface ArtworkAccessGateway {
  createReadUrl(canonicalUrl: string, ttlMs: number): Promise<string>;
}

type TokenPayload = {
  key: string;
  expiresAtMs: number;
};

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function validateKey(key: string): string {
  if (!key || key.startsWith('/') || key.includes('\\')) {
    throw new Error('Artwork locator path is invalid');
  }
  const segments = key.split('/');
  if (
    segments.length !== 2
    || segments.some((segment) => !segment || segment === '.' || segment === '..' || !SAFE_SEGMENT.test(segment))
  ) {
    throw new Error('Artwork locator path is invalid');
  }
  return segments.join('/');
}

function keyFromLocator(locator: string): string {
  if (!locator.startsWith('artwork://')) throw new Error('Artwork locator must use durable private storage');
  return validateKey(locator.slice('artwork://'.length));
}

export class SignedArtworkAccess implements ArtworkAccessGateway {
  private readonly origin: string;

  constructor(
    private readonly signingKey: string,
    origin: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (signingKey.trim().length < 24) throw new Error('Artwork signing key is not configured safely');
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'https:') throw new Error('Artwork app origin must use HTTPS');
    this.origin = parsedOrigin.origin;
  }

  async createReadUrl(canonicalUrl: string, ttlMs: number): Promise<string> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_READ_WINDOW_MS) {
      throw new Error('Artwork read window is invalid');
    }
    const payload: TokenPayload = {
      key: keyFromLocator(canonicalUrl),
      expiresAtMs: this.now().getTime() + ttlMs,
    };
    const body = encodeBase64Url(JSON.stringify(payload));
    const signature = this.sign(body);
    return `${this.origin}/api/artwork/${encodeURIComponent(`${body}.${signature}`)}`;
  }

  verifyToken(token: string): { key: string; expiresAt: Date } {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Artwork token is invalid');
    const [body, signature] = parts;
    const expected = this.sign(body);
    const providedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      providedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new Error('Artwork token signature is invalid');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeBase64Url(body));
    } catch {
      throw new Error('Artwork token is invalid');
    }
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof (parsed as TokenPayload).key !== 'string'
      || !Number.isSafeInteger((parsed as TokenPayload).expiresAtMs)
    ) {
      throw new Error('Artwork token is invalid');
    }

    const key = validateKey((parsed as TokenPayload).key);
    const expiresAtMs = (parsed as TokenPayload).expiresAtMs;
    if (expiresAtMs <= this.now().getTime()) throw new Error('Artwork token has expired');
    if (expiresAtMs - this.now().getTime() > MAX_READ_WINDOW_MS) {
      throw new Error('Artwork token read window is invalid');
    }
    return { key, expiresAt: new Date(expiresAtMs) };
  }

  private sign(body: string): string {
    return createHmac('sha256', this.signingKey).update(body, 'utf8').digest('base64url');
  }
}
