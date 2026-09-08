import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, expect, test, vi } from 'vitest';

const { createSupportServiceMock, sendCanaryMock } = vi.hoisted(() => ({
  createSupportServiceMock: vi.fn(),
  sendCanaryMock: vi.fn(),
}));

vi.mock('@/server/support/runtimeSupport', () => ({
  createSupportService: createSupportServiceMock,
}));

const releaseId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const internalToken = 'support-canary-internal-token-1234567890';

async function loadPost() {
  const routePath = join(process.cwd(), 'src/app/api/internal/support-canary/route.ts');
  expect(existsSync(routePath), 'support canary route must exist').toBe(true);
  const route = await import('@/app/api/internal/support-canary/route');
  return route.POST;
}

function request(bodyReleaseId: string, token?: string) {
  return new Request('https://issuedonce.shop/api/internal/support-canary', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ releaseId: bodyReleaseId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_OPERATIONS_TOKEN = internalToken;
  process.env.ISSUED_ONCE_RELEASE_ID = releaseId;
  process.env.SUPPORT_INBOX_EMAIL = 'support@example.com';
  sendCanaryMock.mockResolvedValue({ providerMessageId: 'support-canary-mail-1' });
  createSupportServiceMock.mockReturnValue({ sendCanary: sendCanaryMock });
});

test('rejects an unauthenticated support canary before any email is sent', async () => {
  const POST = await loadPost();
  const response = await POST(request(releaseId));

  expect(response.status).toBe(401);
  expect(sendCanaryMock).not.toHaveBeenCalled();
});

test('rejects a support canary when the requested release is not the deployed release', async () => {
  const POST = await loadPost();
  const response = await POST(request('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', internalToken));

  expect(response.status).toBe(409);
  expect(sendCanaryMock).not.toHaveBeenCalled();
});

test('sends one no-customer-data canary only for the authenticated exact deployed release', async () => {
  const POST = await loadPost();
  const response = await POST(request(releaseId, internalToken));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sent: true, releaseId });
  expect(sendCanaryMock).toHaveBeenCalledOnce();
  expect(sendCanaryMock).toHaveBeenCalledWith({ releaseId, replyTo: 'support@example.com' });
});

test('does not leak support delivery error details into server logs', async () => {
  const sensitiveMarker = 'support-provider-secret-sentinel';
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  sendCanaryMock.mockRejectedValueOnce(
    new Error(`provider request failed with sensitive detail ${sensitiveMarker}`),
  );

  try {
    const POST = await loadPost();
    const response = await POST(request(releaseId, internalToken));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Support delivery unavailable' });

    const loggedText = consoleError.mock.calls
      .flat()
      .map((value) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value)))
      .join(' ');
    expect(loggedText).not.toContain(sensitiveMarker);
  } finally {
    consoleError.mockRestore();
  }
});
