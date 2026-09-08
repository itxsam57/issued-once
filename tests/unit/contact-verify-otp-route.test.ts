import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, createContactServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createContactServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/contact/runtimeContact', () => ({
  createContactService: createContactServiceMock,
  ContactRuntimeUnavailableError: class ContactRuntimeUnavailableError extends Error {},
}));

import { POST as verifyOtp } from '@/app/api/contact/verify-otp/route';

function request(body: unknown = { challengeId: 'challenge-1', code: '123456' }) {
  return new Request('http://localhost/api/contact/verify-otp', {
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

describe('contact OTP verification route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession('session-token');
  });

  it('does not log unknown OTP verification error details', async () => {
    const sentinel = 'otp-verification-secret-sentinel';
    createContactServiceMock.mockReturnValue({
      verifyOtp: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await verifyOtp(request());
    const renderedLogs = errorSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Contact verification failed' });
    expect(renderedLogs).not.toContain(sentinel);

    errorSpy.mockRestore();
  });
});
