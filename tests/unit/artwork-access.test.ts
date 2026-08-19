import { expect, test, vi } from 'vitest';
import { VercelBlobArtworkAccess } from '@/server/design/VercelBlobArtworkAccess';

test('signs a private canonical Blob URL for a bounded read window', async () => {
  const issueSignedToken = vi.fn(async (options) => {
    expect(options).toMatchObject({
      pathname: 'issues/issue-1/design/job-1.png',
      operations: ['get'],
      validUntil: Date.parse('2026-08-25T00:00:00.000Z'),
      token: 'blob-token',
    });
    return {
      delegationToken: 'delegation',
      clientSigningToken: 'signing',
      validUntil: options.validUntil!,
    };
  });
  const presignUrl = vi.fn(async (_token, options) => {
    expect(options).toMatchObject({
      operation: 'get',
      pathname: 'issues/issue-1/design/job-1.png',
      access: 'private',
      validUntil: Date.parse('2026-08-25T00:00:00.000Z'),
      useCache: false,
    });
    return {
      presignedUrl: 'https://store.private.blob.vercel-storage.com/issues/issue-1/design/job-1.png?signed=1',
    };
  });

  const access = new VercelBlobArtworkAccess(
    'blob-token',
    () => new Date('2026-08-19T00:00:00.000Z'),
    issueSignedToken as never,
    presignUrl as never,
  );

  await expect(access.createReadUrl(
    'https://store.private.blob.vercel-storage.com/issues/issue-1/design/job-1.png',
    6 * 24 * 60 * 60 * 1000,
  )).resolves.toContain('?signed=1');
});

test('refuses public/non-Blob origins and read windows beyond the factory safety cap', async () => {
  const access = new VercelBlobArtworkAccess('blob-token');
  await expect(access.createReadUrl('https://public.example/design.png', 60_000)).rejects.toThrow(/private Blob/i);
  await expect(access.createReadUrl(
    'https://store.private.blob.vercel-storage.com/issues/a.png',
    7 * 24 * 60 * 60 * 1000,
  )).rejects.toThrow(/read window/i);
});
