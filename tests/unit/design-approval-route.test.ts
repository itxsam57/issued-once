import { afterEach, expect, test, vi } from 'vitest';

const { createDesignServiceMock } = vi.hoisted(() => ({ createDesignServiceMock: vi.fn() }));
vi.mock('@/server/design/runtimeDesign', () => ({ createDesignService: createDesignServiceMock }));

import { POST } from '@/app/api/internal/design/approve/route';

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
  vi.clearAllMocks();
});

test('rejects design approval without owner authorization', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
  const response = await POST(new Request('https://issuedonce.shop/api/internal/design/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId: 'a45f40f8-3819-4ea3-b696-595e91f63e3a' }),
  }));
  expect(response.status).toBe(401);
  expect(createDesignServiceMock).not.toHaveBeenCalled();
});

test('approved owner request invokes the deterministic design approval gate', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
  const approveForManufacturing = vi.fn().mockResolvedValue({ id: 'job-1', state: 'APPROVED' });
  createDesignServiceMock.mockReturnValue({ approveForManufacturing });

  const response = await POST(new Request('https://issuedonce.shop/api/internal/design/approve', {
    method: 'POST',
    headers: {
      authorization: 'Bearer owner-secret-token-that-is-long',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ issueId: 'a45f40f8-3819-4ea3-b696-595e91f63e3a' }),
  }));
  expect(response.status).toBe(200);
  expect(approveForManufacturing).toHaveBeenCalledWith('a45f40f8-3819-4ea3-b696-595e91f63e3a');
  expect(await response.json()).toEqual({ designJobId: 'job-1', state: 'APPROVED' });
});
