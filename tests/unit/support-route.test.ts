import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, createSupportServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createSupportServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/support/runtimeSupport', () => ({
  createSupportService: createSupportServiceMock,
  SupportRuntimeUnavailableError: class SupportRuntimeUnavailableError extends Error {},
}));

import { POST as createSupportRequest } from '@/app/api/support/route';

function request(body: unknown = { message: 'Reason: other\n\nSomething went wrong.' }) {
  return new Request('http://localhost/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function withSession(value?: string) {
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(value ? { value } : undefined),
  });
}

describe('public support route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession('issue-session-token');
  });

  it('preserves validation and Issue-session boundaries', async () => {
    expect((await createSupportRequest(request({ message: 'x' }))).status).toBe(400);

    withSession(undefined);
    expect((await createSupportRequest(request())).status).toBe(401);
  });

  it('returns the generated support request id as an opaque customer reference', async () => {
    const createMock = vi.fn().mockResolvedValue({
      requestId: '6f792ea4-74f6-4914-a6f7-a7ef63ec28e4',
      issueCode: 'IO-PRIVATE-CODE',
    });
    createSupportServiceMock.mockReturnValue({ create: createMock });

    const response = await createSupportRequest(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      received: true,
      reference: '6f792ea4-74f6-4914-a6f7-a7ef63ec28e4',
    });
    expect(payload).not.toHaveProperty('issueCode');
    expect(createMock).toHaveBeenCalledWith({
      sessionToken: 'issue-session-token',
      message: 'Reason: other\n\nSomething went wrong.',
    });
  });
});
