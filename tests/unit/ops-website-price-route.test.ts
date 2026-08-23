// @vitest-environment node

import { beforeEach, expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createOpsWebsiteServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsWebsiteServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({ createOpsWebsiteService: createOpsWebsiteServiceMock }));

import { POST } from '@/app/ops/api/website/catalog/price/route';

beforeEach(() => vi.clearAllMocks());

function request(body: unknown) {
  return new Request('https://issuedonce.shop/ops/api/website/catalog/price', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('quick price route authenticates before runtime construction', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const response = await POST(request({ productKey: 'tee', amountMinor: 6100, currency: 'USD' }));
  expect(response.status).toBe(401);
  expect(createOpsWebsiteServiceMock).not.toHaveBeenCalled();
});

test('quick price route delegates one canonical future-sale catalog publication', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const publishProductPrice = vi.fn().mockResolvedValue(5);
  createOpsWebsiteServiceMock.mockReturnValue({ publishProductPrice });

  const response = await POST(request({ productKey: 'tee', amountMinor: 6100, currency: 'USD' }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true, version: 5 });
  expect(publishProductPrice).toHaveBeenCalledWith({ productKey: 'tee', amountMinor: 6100, currency: 'USD' });
});

test('quick price route rejects invalid publication input without leaking internals', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const publishProductPrice = vi.fn().mockRejectedValue(new Error('Quick price currency must match the current catalog'));
  createOpsWebsiteServiceMock.mockReturnValue({ publishProductPrice });

  const response = await POST(request({ productKey: 'tee', amountMinor: 6100, currency: 'PKR' }));

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({ error: 'Quick price currency must match the current catalog' });
});
