import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import type { ArtworkStorageGateway } from '@/server/design/ArtworkStorageGateway';
import { DesignService } from '@/server/design/DesignService';
import type { DesignRepository } from '@/server/design/DesignRepository';
import { PostgresArtworkStorage } from '@/server/design/PostgresArtworkStorage';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

type StoredRow = {
  locator: string;
  issue_id: string;
  design_job_id: string;
  mime_type: string;
  bytes: Buffer;
  byte_count: number;
  content_sha256: string;
};

class DurableMemorySql implements SqlExecutor {
  readonly objects = new Map<string, StoredRow>();

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<Row[]> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.includes('insert into artwork_objects')) {
      const [locator, issueId, designJobId, mimeType, bytes, byteCount, contentSha256] = params;
      if (this.objects.has(String(locator))) throw new Error('duplicate artwork object');
      const row: StoredRow = {
        locator: String(locator),
        issue_id: String(issueId),
        design_job_id: String(designJobId),
        mime_type: String(mimeType),
        bytes: Buffer.from(bytes as Uint8Array),
        byte_count: Number(byteCount),
        content_sha256: String(contentSha256),
      };
      this.objects.set(row.locator, row);
      return [row as unknown as Row];
    }
    if (normalized.includes('from artwork_objects')) {
      const row = this.objects.get(String(params[0]));
      return row ? [structuredClone(row) as unknown as Row] : [];
    }
    throw new Error(`Unexpected SQL in durable artwork test: ${text}`);
  }

  corrupt(locator: string): void {
    const row = this.objects.get(locator);
    if (!row) throw new Error('missing test artwork');
    row.bytes = Buffer.from('corrupted-bytes');
  }

  remove(locator: string): void {
    this.objects.delete(locator);
  }
}

test('artwork bytes survive a fresh storage/runtime instance and remain private', async () => {
  const sql = new DurableMemorySql();
  const original = Buffer.alloc(12_000, 7);
  const firstRuntime = new PostgresArtworkStorage(sql);

  const stored = await firstRuntime.put({
    issueId: 'issue-1',
    designJobId: 'job-1',
    bytes: original,
    mimeType: 'image/png',
  });

  expect(stored.url).toBe('artwork://issue-1/job-1');
  expect(stored.url).not.toContain('/home/');
  expect(stored.url).not.toContain('https://');
  expect(stored.bytes).toBe(original.length);

  const replacementRuntime = new PostgresArtworkStorage(sql);
  await expect(replacementRuntime.get(stored.url)).resolves.toEqual({
    bytes: original,
    mimeType: 'image/png',
  });
});

test('durable artwork reads fail closed for missing or corrupted objects', async () => {
  const sql = new DurableMemorySql();
  const storage = new PostgresArtworkStorage(sql);
  const bytes = Buffer.alloc(12_000, 9);
  const stored = await storage.put({
    issueId: 'issue-2',
    designJobId: 'job-2',
    bytes,
    mimeType: 'image/png',
  });

  sql.corrupt(stored.url);
  await expect(new PostgresArtworkStorage(sql).get(stored.url)).rejects.toThrow(/integrity/i);

  sql.objects.set(stored.url, {
    locator: stored.url,
    issue_id: 'issue-2',
    design_job_id: 'job-2',
    mime_type: 'image/png',
    bytes,
    byte_count: bytes.length,
    content_sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  sql.remove(stored.url);
  await expect(new PostgresArtworkStorage(sql).get(stored.url)).rejects.toThrow(/unavailable|missing/i);
});

test('design approval reopens durable artwork and never approves metadata-only records', async () => {
  const approve = vi.fn();
  const repository = {
    loadInput: vi.fn(async () => ({
      issueId: 'issue-3', issueCode: 'IO-TEST-0003', issueStatus: 'DESIGN_REVIEW',
      objectType: 'tee', sizeCode: 'M', colorCode: 'Black', questions: [],
    })),
    findByIssueId: vi.fn(async () => ({
      id: 'job-3', issueId: 'issue-3', state: 'REVIEW', encryptedBrief: null,
      artworkUrl: 'artwork://issue-3/job-3', artworkMimeType: 'image/png', artworkBytes: 12_000,
      width: 1800, height: 2400, provider: 'OWNER', model: 'MANUAL_UPLOAD',
      createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-01T00:00:00Z'),
    })),
    approve,
  } as unknown as DesignRepository;
  const storage: ArtworkStorageGateway = {
    put: vi.fn(),
    get: vi.fn(async () => { throw new Error('Artwork is unavailable'); }),
  };
  const service = new DesignService(
    repository,
    { interpret: vi.fn(), generateArtwork: vi.fn() },
    storage,
    undefined,
    undefined,
    undefined,
    { resolve: (input) => ({ ...input, placementWidth: 1800, placementHeight: 2400, targetDpi: 300 }) },
  );

  await expect(service.approveForManufacturing('issue-3')).rejects.toThrow(/unavailable/i);
  expect(storage.get).toHaveBeenCalledWith('artwork://issue-3/job-3');
  expect(approve).not.toHaveBeenCalled();
});
