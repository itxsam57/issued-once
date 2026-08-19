import { beforeEach, expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createOpsRepositoryMock, createArtworkAccessMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsRepositoryMock: vi.fn(),
  createArtworkAccessMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOps', () => ({
  createOpsRepository: createOpsRepositoryMock,
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/design/runtimeArtworkAccess', () => ({
  createArtworkAccess: createArtworkAccessMock,
  ArtworkAccessRuntimeUnavailableError: class ArtworkAccessRuntimeUnavailableError extends Error {},
}));

import { GET } from '@/app/ops/api/issues/route';

beforeEach(() => {
  vi.clearAllMocks();
  hasOpsSessionMock.mockResolvedValue(true);
  createArtworkAccessMock.mockReturnValue({
    createReadUrl: vi.fn(async () => 'https://store.private.blob.vercel-storage.com/issues/i/design/d.png?signed=ops'),
  });
  createOpsRepositoryMock.mockReturnValue({
    listRecent: vi.fn(async () => [{
      issueId: '11111111-1111-4111-8111-111111111111', issueCode: 'IO-ABCD-EFGH', status: 'DESIGN_REVIEW',
      objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 5400, currency: 'USD',
      designJobId: '22222222-2222-4222-8222-222222222222', designState: 'REVIEW',
      artworkUrl: 'https://store.private.blob.vercel-storage.com/issues/i/design/d.png',
      artworkWidth: 2048, artworkHeight: 3072, manufacturingJobId: null, manufacturingState: null,
      providerOrderId: null, trackingNumber: null, updatedAt: new Date('2026-08-19T00:00:00Z'),
    }]),
  });
});

test('ops list replaces canonical private artwork with a five-minute signed read URL', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.issues[0].artworkUrl).toContain('?signed=ops');
  expect(createArtworkAccessMock().createReadUrl).toHaveBeenCalledWith(
    'https://store.private.blob.vercel-storage.com/issues/i/design/d.png',
    5 * 60 * 1000,
  );
});

test('unauthorized ops request never receives artwork data', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const response = await GET();
  expect(response.status).toBe(401);
  expect(createOpsRepositoryMock).not.toHaveBeenCalled();
});
