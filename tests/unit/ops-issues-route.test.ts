import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasOpsSession: vi.fn(),
  createOpsRepository: vi.fn(),
  createArtworkAccess: vi.fn(),
  listIssues: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: mocks.hasOpsSession }));
vi.mock('@/server/ops/runtimeOps', () => ({
  createOpsRepository: mocks.createOpsRepository,
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsIssueDetailRepository: () => ({ listIssues: mocks.listIssues }),
}));
vi.mock('@/server/design/runtimeArtworkAccess', () => ({
  createArtworkAccess: mocks.createArtworkAccess,
  ArtworkAccessRuntimeUnavailableError: class ArtworkAccessRuntimeUnavailableError extends Error {},
}));

import { GET } from '@/app/ops/api/issues/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasOpsSession.mockResolvedValue(true);
  mocks.createArtworkAccess.mockReturnValue({
    createReadUrl: vi.fn(async () => 'https://store.private.blob.vercel-storage.com/issues/i/design/d.png?signed=ops'),
  });
  mocks.createOpsRepository.mockReturnValue({
    listRecent: vi.fn(async () => [{
      issueId: '11111111-1111-4111-8111-111111111111', issueCode: 'IO-ABCD-EFGH', status: 'DESIGN_REVIEW',
      objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 5400, currency: 'USD',
      designJobId: '22222222-2222-4222-8222-222222222222', designState: 'REVIEW',
      artworkUrl: 'https://store.private.blob.vercel-storage.com/issues/i/design/d.png',
      artworkWidth: 2048, artworkHeight: 3072, manufacturingJobId: null, manufacturingState: null,
      providerOrderId: null, trackingNumber: null, updatedAt: new Date('2026-08-19T00:00:00Z'),
    }]),
  });
  mocks.listIssues.mockResolvedValue({ items: [], nextCursor: null });
});

test('ops compatibility list replaces canonical private artwork with a five-minute signed read URL', async () => {
  const response = await GET(new Request('https://issuedonce.shop/ops/api/issues'));
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.issues[0].artworkUrl).toContain('?signed=ops');
  expect(mocks.createArtworkAccess().createReadUrl).toHaveBeenCalledWith(
    'https://store.private.blob.vercel-storage.com/issues/i/design/d.png',
    5 * 60 * 1000,
  );
});

test('ledger route parses country, date and operational filters server-side', async () => {
  const response = await GET(new Request(
    'https://issuedonce.shop/ops/api/issues?view=ledger&search=IO-ABCD&issueStatus=DESIGN_REVIEW&paymentStatus=PAID&designState=REVIEW&manufacturingState=DRAFT&objectType=tee&supportOpen=true&paymentException=false&country=pk&from=2026-08-18&to=2026-08-19',
  ));
  expect(response.status).toBe(200);
  expect(mocks.listIssues).toHaveBeenCalledTimes(1);
  const input = mocks.listIssues.mock.calls[0][0];
  expect(input.search).toBe('IO-ABCD');
  expect(input.filters).toEqual(expect.objectContaining({
    issueStatus: 'DESIGN_REVIEW', paymentStatus: 'PAID', designState: 'REVIEW', manufacturingState: 'DRAFT', objectType: 'tee',
    supportOpen: true, paymentException: false, countryCode: 'pk',
  }));
  expect(input.filters.updatedFrom.toISOString()).toBe('2026-08-18T00:00:00.000Z');
  expect(input.filters.updatedTo.toISOString()).toBe('2026-08-19T23:59:59.999Z');
  expect(mocks.createOpsRepository).not.toHaveBeenCalled();
});

test('ledger route rejects malformed date filters', async () => {
  const response = await GET(new Request('https://issuedonce.shop/ops/api/issues?view=ledger&from=not-a-date'));
  expect(response.status).toBe(400);
  expect(mocks.listIssues).not.toHaveBeenCalled();
});

test('unauthorized ops request never receives artwork data', async () => {
  mocks.hasOpsSession.mockResolvedValue(false);
  const response = await GET(new Request('https://issuedonce.shop/ops/api/issues'));
  expect(response.status).toBe(401);
  expect(mocks.createOpsRepository).not.toHaveBeenCalled();
  expect(mocks.listIssues).not.toHaveBeenCalled();
});
