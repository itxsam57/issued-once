import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FilesystemArtworkStorage } from '@/server/design/FilesystemArtworkStorage';

let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'issued-once-artwork-'));
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test('writes a private PNG below the configured root and returns only an opaque locator', async () => {
  const storage = new FilesystemArtworkStorage(root);
  const bytes = Buffer.alloc(12_000, 7);

  await expect(storage.put({
    issueId: 'issue-1',
    designJobId: 'job-1',
    bytes,
    mimeType: 'image/png',
  })).resolves.toEqual({
    url: 'fs://issues/issue-1/design/job-1.png',
    bytes: 12_000,
  });

  await expect(readFile(join(root, 'issues', 'issue-1', 'design', 'job-1.png'))).resolves.toEqual(bytes);
});

test('creates exclusively and never silently overwrites existing artwork', async () => {
  const storage = new FilesystemArtworkStorage(root);
  const input = {
    issueId: 'issue-1',
    designJobId: 'job-1',
    bytes: Buffer.from('first'),
    mimeType: 'image/png' as const,
  };
  await storage.put(input);
  await expect(storage.put({ ...input, bytes: Buffer.from('second') })).rejects.toThrow();
  await expect(readFile(join(root, 'issues', 'issue-1', 'design', 'job-1.png'), 'utf8')).resolves.toBe('first');
});

test('rejects empty content and traversal-shaped identifiers', async () => {
  const storage = new FilesystemArtworkStorage(root);
  await expect(storage.put({
    issueId: 'issue-1',
    designJobId: 'job-1',
    bytes: Buffer.alloc(0),
    mimeType: 'image/png',
  })).rejects.toThrow(/empty/i);

  await expect(storage.put({
    issueId: '../escape',
    designJobId: 'job-1',
    bytes: Buffer.from('png'),
    mimeType: 'image/png',
  })).rejects.toThrow(/identifier/i);

  await expect(storage.put({
    issueId: 'issue-1',
    designJobId: '..\\escape',
    bytes: Buffer.from('png'),
    mimeType: 'image/png',
  })).rejects.toThrow(/identifier/i);
});
