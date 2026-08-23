import { beforeEach, expect, test, vi } from 'vitest';

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));
vi.mock('@vercel/blob', () => ({ put: putMock }));

import { VercelBlobArtworkStorage } from '@/server/design/VercelBlobArtworkStorage';

beforeEach(() => {
  vi.clearAllMocks();
  putMock.mockResolvedValue({
    url: 'https://store.private.blob.vercel-storage.com/issues/issue-1/design/job-1.png',
  });
});

test('stores the canonical production PNG in private Blob with no random suffix or overwrite', async () => {
  const storage = new VercelBlobArtworkStorage('blob-secret');
  const bytes = Buffer.alloc(12_000, 1);

  await expect(storage.put({
    issueId: 'issue-1',
    designJobId: 'job-1',
    bytes,
    mimeType: 'image/png',
  })).resolves.toEqual({
    url: 'https://store.private.blob.vercel-storage.com/issues/issue-1/design/job-1.png',
    bytes: 12_000,
  });

  expect(putMock).toHaveBeenCalledWith(
    'issues/issue-1/design/job-1.png',
    bytes,
    {
      access: 'private',
      contentType: 'image/png',
      addRandomSuffix: false,
      allowOverwrite: false,
      token: 'blob-secret',
    },
  );
});
