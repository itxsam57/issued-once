import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasOpsSession: vi.fn(),
  listRecent: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: mocks.hasOpsSession }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsAuditService: () => ({ listRecent: mocks.listRecent }),
}));

import { GET } from '@/app/ops/api/audit/route';

beforeEach(() => {
  mocks.hasOpsSession.mockReset();
  mocks.listRecent.mockReset();
});

test('audit route requires an owner session', async () => {
  mocks.hasOpsSession.mockResolvedValue(false);
  const response = await GET(new Request('https://issuedonce.shop/ops/api/audit'));
  expect(response.status).toBe(401);
  expect(mocks.listRecent).not.toHaveBeenCalled();
});

test('audit route forwards bounded filters and returns newest safe records', async () => {
  mocks.hasOpsSession.mockResolvedValue(true);
  mocks.listRecent.mockResolvedValue({
    items: [{
      id: '11111111-1111-1111-1111-111111111111', actor: 'OWNER', action: 'DESIGN_APPROVED',
      issueId: '22222222-2222-2222-2222-222222222222', targetType: 'design_job', targetId: 'd1', reason: null,
      safeMetadata: { state: 'APPROVED' }, createdAt: new Date('2026-08-19T10:00:00Z'),
    }],
    nextCursor: 'next',
  });
  const response = await GET(new Request('https://issuedonce.shop/ops/api/audit?action=DESIGN_APPROVED&issueCode=IO-ABCD&target=design&from=2026-08-18T00:00:00.000Z&to=2026-08-19T23:59:59.999Z'));
  expect(response.status).toBe(200);
  expect(mocks.listRecent).toHaveBeenCalledWith(expect.objectContaining({
    action: 'DESIGN_APPROVED', issueCode: 'IO-ABCD', target: 'design', limit: 50,
  }));
  const body = await response.json() as { items: unknown[]; nextCursor: string };
  expect(body.items).toHaveLength(1);
  expect(JSON.stringify(body)).not.toMatch(/email|phone|address|ciphertext|secret/i);
  expect(body.nextCursor).toBe('next');
});
