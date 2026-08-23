// @vitest-environment node

import { beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';

const { hasOpsSessionMock, createOpsDesignPolicyServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsDesignPolicyServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({ createOpsDesignPolicyService: createOpsDesignPolicyServiceMock }));

import { GET as getGlobal, PUT as putGlobal } from '@/app/ops/api/designer/policy/route';
import { DELETE as deleteIssue, GET as getIssue, PUT as putIssue } from '@/app/ops/api/designer/[issueId]/policy/route';

const issueId = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ issueId }) };

beforeEach(() => vi.clearAllMocks());

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('global policy route is owner-authenticated and no-store', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  expect((await getGlobal()).status).toBe(401);

  hasOpsSessionMock.mockResolvedValue(true);
  createOpsDesignPolicyServiceMock.mockReturnValue({
    getGlobal: vi.fn().mockResolvedValue({ source: 'DEFAULT', version: 0, policy: DEFAULT_DESIGN_POLICY }),
  });
  const response = await getGlobal();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/no-store/);
  await expect(response.json()).resolves.toMatchObject({ source: 'DEFAULT', version: 0, policy: DEFAULT_DESIGN_POLICY });
});

test('global policy PUT publishes only a complete validated policy', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const publishGlobal = vi.fn().mockResolvedValue({ version: 4, policy: { ...DEFAULT_DESIGN_POLICY, mode: 'MANUAL' } });
  createOpsDesignPolicyServiceMock.mockReturnValue({ publishGlobal });

  const response = await putGlobal(jsonRequest('https://issuedonce.shop/ops/api/designer/policy', { ...DEFAULT_DESIGN_POLICY, mode: 'MANUAL' }));
  expect(response.status).toBe(200);
  expect(publishGlobal).toHaveBeenCalledWith({ ...DEFAULT_DESIGN_POLICY, mode: 'MANUAL' });
});

test('per-Issue policy GET/PUT/DELETE exposes effective settings and override control', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const getEffective = vi.fn().mockResolvedValue({ globalVersion: 4, override: null, policy: DEFAULT_DESIGN_POLICY });
  const setIssueOverride = vi.fn()
    .mockResolvedValueOnce({ globalVersion: 4, override: { mode: 'AUTO' }, policy: { ...DEFAULT_DESIGN_POLICY, mode: 'AUTO' } })
    .mockResolvedValueOnce({ globalVersion: 4, override: null, policy: DEFAULT_DESIGN_POLICY });
  createOpsDesignPolicyServiceMock.mockReturnValue({ getEffective, setIssueOverride });

  const got = await getIssue(new Request(`https://issuedonce.shop/ops/api/designer/${issueId}/policy`), context);
  expect(got.status).toBe(200);
  expect(getEffective).toHaveBeenCalledWith(issueId);

  const updated = await putIssue(jsonRequest(`https://issuedonce.shop/ops/api/designer/${issueId}/policy`, { mode: 'AUTO' }), context);
  expect(updated.status).toBe(200);
  expect(setIssueOverride).toHaveBeenNthCalledWith(1, issueId, { mode: 'AUTO' });

  const cleared = await deleteIssue(new Request(`https://issuedonce.shop/ops/api/designer/${issueId}/policy`, { method: 'DELETE' }), context);
  expect(cleared.status).toBe(200);
  expect(setIssueOverride).toHaveBeenNthCalledWith(2, issueId, null);
});
