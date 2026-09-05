import { afterEach, expect, test, vi } from 'vitest';

const { createDesignServiceMock } = vi.hoisted(() => ({ createDesignServiceMock: vi.fn() }));
vi.mock('@/server/design/runtimeDesign', () => ({
  createDesignService: createDesignServiceMock,
  DesignRuntimeUnavailableError: class DesignRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/internal/design/approve/route';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';
const ownerToken = 'owner-secret-token-that-is-long';

function request(token = ownerToken) {
  return new Request('https://issuedonce.shop/api/internal/design/approve', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ issueId }),
  });
}

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
  vi.clearAllMocks();
});

test('rejects design approval without owner authorization', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const response = await POST(new Request('https://issuedonce.shop/api/internal/design/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueId }),
  }));
  expect(response.status).toBe(401);
  expect(createDesignServiceMock).not.toHaveBeenCalled();
});

test('approved owner request invokes the deterministic design approval gate', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const approveForManufacturing = vi.fn().mockResolvedValue({ id: 'job-1', state: 'APPROVED' });
  createDesignServiceMock.mockReturnValue({ approveForManufacturing });

  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(approveForManufacturing).toHaveBeenCalledWith(issueId);
  expect(await response.json()).toEqual({ designJobId: 'job-1', state: 'APPROVED' });
});

test('does not leak unexpected design approval error details into server logs', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const sensitiveMarker = 'design-provider-secret-sentinel';
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const approveForManufacturing = vi.fn().mockRejectedValueOnce(
    new Error(`unexpected upstream failure ${sensitiveMarker}`),
  );
  createDesignServiceMock.mockReturnValue({ approveForManufacturing });

  try {
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Design approval failed' });

    const loggedText = consoleError.mock.calls.flat()
      .map((value) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value)))
      .join(' ');
    expect(loggedText).not.toContain(sensitiveMarker);
  } finally {
    consoleError.mockRestore();
  }
});
