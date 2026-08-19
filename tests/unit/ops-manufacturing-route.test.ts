import { afterEach, expect, test, vi } from 'vitest';

const {
  hasOpsSessionMock,
  createOpsRepositoryMock,
  createOpsManufacturingServiceMock,
  enqueueIssueNotificationMock,
} = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsRepositoryMock: vi.fn(),
  createOpsManufacturingServiceMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOps', () => ({
  createOpsRepository: createOpsRepositoryMock,
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsManufacturingService: createOpsManufacturingServiceMock,
}));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));

import { POST } from '@/app/ops/api/manufacturing/confirm/route';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';

afterEach(() => {
  delete process.env.PRINTFUL_ALLOW_CONFIRM;
  vi.clearAllMocks();
});

test('requires owner session, kill switch and exact public Issue Code phrase before charging Printful', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  createOpsRepositoryMock.mockReturnValue({
    findById: vi.fn().mockResolvedValue({ issueId, issueCode: 'IO-ABCD-EFGH' }),
  });
  const confirmDraft = vi.fn().mockResolvedValue({ id: 'mfg-1', issueId, state: 'IN_PRODUCTION' });
  createOpsManufacturingServiceMock.mockReturnValue({ confirmDraft });
  enqueueIssueNotificationMock.mockResolvedValue(undefined);

  const disabled = await POST(new Request('https://issuedonce.shop/ops/api/manufacturing/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId, confirmation: 'CONFIRM IO-ABCD-EFGH' }),
  }));
  expect(disabled.status).toBe(503);
  expect(confirmDraft).not.toHaveBeenCalled();

  process.env.PRINTFUL_ALLOW_CONFIRM = 'true';
  const wrong = await POST(new Request('https://issuedonce.shop/ops/api/manufacturing/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId, confirmation: 'CONFIRM SOMETHING-ELSE' }),
  }));
  expect(wrong.status).toBe(400);
  expect(confirmDraft).not.toHaveBeenCalled();

  const approved = await POST(new Request('https://issuedonce.shop/ops/api/manufacturing/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId, confirmation: 'CONFIRM IO-ABCD-EFGH' }),
  }));
  expect(approved.status).toBe(200);
  expect(confirmDraft).toHaveBeenCalledWith(issueId);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(issueId, 'IN_PRODUCTION');
});

test('unauthenticated owner room request never reaches factory', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  process.env.PRINTFUL_ALLOW_CONFIRM = 'true';
  const response = await POST(new Request('https://issuedonce.shop/ops/api/manufacturing/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId, confirmation: 'CONFIRM IO-ABCD-EFGH' }),
  }));
  expect(response.status).toBe(401);
  expect(createOpsManufacturingServiceMock).not.toHaveBeenCalled();
});
