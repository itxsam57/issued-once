// @vitest-environment node

import { beforeEach, expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/referrals/runtimeReferralLaunchOutreach', () => ({
  createReferralLaunchOutreachService: createServiceMock,
}));

import { POST } from '@/app/ops/api/referrals/launch-outreach/route';

beforeEach(() => vi.clearAllMocks());

function request(body: unknown) {
  return new Request('https://issuedonce.shop/ops/api/referrals/launch-outreach', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('launch outreach rejects unauthenticated calls before runtime construction', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const response = await POST(request({ confirmation: 'SEND_LAUNCH_REFERRALS' }));
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toMatch(/no-store/);
  expect(createServiceMock).not.toHaveBeenCalled();
});

test('authenticated owner still needs the explicit launch confirmation', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const response = await POST(request({ campaign: 'launch-v1', limit: 50 }));
  expect(response.status).toBe(400);
  expect(createServiceMock).not.toHaveBeenCalled();
});

test('confirmed owner launch delegates a bounded batch and returns only safe counts', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const sendBatch = vi.fn().mockResolvedValue({ considered: 7, sent: 5, skipped: 1, failed: 1 });
  createServiceMock.mockReturnValue({ sendBatch });

  const response = await POST(request({
    confirmation: 'SEND_LAUNCH_REFERRALS',
    campaign: 'launch-v1',
    limit: 50,
  }));

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/no-store/);
  expect(sendBatch).toHaveBeenCalledWith({ campaign: 'launch-v1', limit: 50 });
  await expect(response.json()).resolves.toEqual({ ok: true, considered: 7, sent: 5, skipped: 1, failed: 1 });
});
