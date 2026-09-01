import { createHash } from 'node:crypto';
import type { ArtworkStorageGateway, ReadArtwork, StoredArtwork } from './ArtworkStorageGateway';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

const ISSUE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;
const ARTIFACT_IDENTIFIER = /^[A-Za-z0-9_:-]+$/;
const SHA256_HEX = /^[0-9a-f]{64}$/i;

export class ArtworkUnavailableError extends Error {
  constructor(message = 'Artwork is unavailable') {
    super(message);
    this.name = 'ArtworkUnavailableError';
  }
}

export class ArtworkIntegrityError extends Error {
  constructor(message = 'Artwork integrity check failed') {
    super(message);
    this.name = 'ArtworkIntegrityError';
  }
}

type ArtworkRow = {
  locator: string;
  mime_type: string;
  bytes: Buffer | Uint8Array | string;
  byte_count: number | string;
  content_sha256: string;
};

function assertIdentifier(value: string, pattern: RegExp, name: string): string {
  if (!pattern.test(value)) throw new Error(`${name} identifier is invalid`);
  return value;
}

function locatorFor(issueId: string, designJobId: string): string {
  return `artwork://${assertIdentifier(issueId, ISSUE_IDENTIFIER, 'Issue')}/${assertIdentifier(designJobId, ARTIFACT_IDENTIFIER, 'Design job')}`;
}

function validateLocator(locator: string): string {
  if (!locator.startsWith('artwork://')) throw new ArtworkUnavailableError();
  const key = locator.slice('artwork://'.length);
  const segments = key.split('/');
  if (segments.length !== 2) throw new ArtworkUnavailableError();
  const [issueId, designJobId] = segments;
  const canonical = locatorFor(issueId, designJobId);
  if (canonical !== locator) throw new ArtworkUnavailableError();
  return canonical;
}

function bytesFromDatabase(value: ArtworkRow['bytes']): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && /^\\x[0-9a-f]*$/i.test(value)) {
    return Buffer.from(value.slice(2), 'hex');
  }
  throw new ArtworkIntegrityError();
}

export class PostgresArtworkStorage implements ArtworkStorageGateway {
  constructor(private readonly sql: SqlExecutor) {}

  async put(input: {
    issueId: string;
    designJobId: string;
    bytes: Buffer;
    mimeType: 'image/png';
  }): Promise<StoredArtwork> {
    if (!input.bytes.length) throw new Error('Artwork cannot be empty');
    const locator = locatorFor(input.issueId, input.designJobId);
    const contentSha256 = createHash('sha256').update(input.bytes).digest('hex');

    await this.sql.query(
      `INSERT INTO artwork_objects (
         locator, issue_id, design_job_id, mime_type, bytes, byte_count, content_sha256
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
      [
        locator,
        input.issueId,
        input.designJobId,
        input.mimeType,
        input.bytes,
        input.bytes.length,
        contentSha256,
      ],
    );

    return { url: locator, bytes: input.bytes.length };
  }

  async get(url: string): Promise<ReadArtwork> {
    const locator = validateLocator(url);
    const rows = await this.sql.query<ArtworkRow>(
      `SELECT locator, mime_type, bytes, byte_count, content_sha256
       FROM artwork_objects
       WHERE locator=$1
       LIMIT 1`,
      [locator],
    );
    const row = rows[0];
    if (!row) throw new ArtworkUnavailableError();
    if (row.locator !== locator || row.mime_type !== 'image/png') throw new ArtworkIntegrityError();

    const bytes = bytesFromDatabase(row.bytes);
    const byteCount = Number(row.byte_count);
    if (!Number.isSafeInteger(byteCount) || byteCount <= 0 || bytes.length !== byteCount) {
      throw new ArtworkIntegrityError();
    }
    if (!SHA256_HEX.test(row.content_sha256)) throw new ArtworkIntegrityError();
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== row.content_sha256.toLowerCase()) throw new ArtworkIntegrityError();

    return { bytes, mimeType: 'image/png' };
  }
}
