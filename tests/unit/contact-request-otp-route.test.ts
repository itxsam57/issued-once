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

import { POST as requestOtp } from '@/app/api/contact/request-otp/route';
import { ContactRuntimeUnavailableError } from '@/server/contact/runtimeContact';

function request(body: unknown = { email: 'sam@example.com' }) {
  return new Request('http://localhost/api/contact/request-otp', {
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

describe('contact OTP request route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession('session-token');
  });

  it('preserves validation and session boundaries', async () => {
    expect((await requestOtp(request({ email: 'not-an-email' }))).status).toBe(400);

    withSession(undefined);
    expect((await requestOtp(request())).status).toBe(401);
  });

  it('preserves successful OTP request behavior', async () => {
    const result = { challengeId: 'challenge-1', expiresAt: '2026-08-31T12:00:00.000Z' };
    const requestOtpMock = vi.fn().mockResolvedValue(result);
    createContactServiceMock.mockReturnValue({ requestOtp: requestOtpMock });

    const response = await requestOtp(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requestOtpMock).toHaveBeenCalledWith({
      experienceToken: 'session-token',
      email: 'sam@example.com',
      ipKey: 'unknown',
    });
  });

  it.each([
    [new ContactRuntimeUnavailableError('provider configuration detail'), 503, 'Contact verification is unavailable'],
    [new Error('Please wait before resend'), 429, 'A code was sent recently. Try again shortly.'],
    [new Error('Experience stage does not allow this email'), 409, 'Contact verification could not be started'],
  ])('preserves safe classified failure behavior', async (error, status, message) => {
    if (error instanceof ContactRuntimeUnavailableError) {
      createContactServiceMock.mockImplementation(() => { throw error; });
    } else {
      createContactServiceMock.mockReturnValue({ requestOtp: vi.fn().mockRejectedValue(error) });
    }

    const response = await requestOtp(request());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it('does not log unknown downstream error details', async () => {
    const sentinel = 'otp-provider-secret-sentinel';
    createContactServiceMock.mockReturnValue({
      requestOtp: vi.fn().mockRejectedValue(new Error(sentinel)),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await requestOtp(request());
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
