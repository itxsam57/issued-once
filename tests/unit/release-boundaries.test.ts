import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createQueueSchemaPing, createStorageReadWritePing } from '@/server/runtime/releaseBoundaries';

let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'issued-once-release-probe-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test('storage probe proves private write/read capability and removes its probe file', async () => {
  const ping = createStorageReadWritePing(root);
  await expect(ping()).resolves.toBe(true);
  await expect(readFile(join(root, '.issued-once-health-probe'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
});

test('queue schema probe reports ready only when the background_jobs table exists', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce([{ relation_name: 'background_jobs' }])
    .mockResolvedValueOnce([{ relation_name: null }]);
  const ping = createQueueSchemaPing({ query } as never);

  await expect(ping()).resolves.toBe(true);
  await expect(ping()).resolves.toBe(false);
  expect(query).toHaveBeenCalledWith(
    "SELECT to_regclass('public.background_jobs')::text AS relation_name",
  );
});
