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

function request() {
  return new Request('http://localhost/api/contact/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: 'challenge-1', code: '000000' }),
  });
}

function otpError(message: string, code: string, attemptsRemaining?: number) {
  return Object.assign(new Error(message), { code, attemptsRemaining });
}

describe('typed OTP route failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'session-token' }),
    });
  });

  it.each([
    ['OTP code is invalid', 'WRONG_CODE', 409, 4],
    ['OTP attempt limit reached', 'ATTEMPT_LIMIT', 429, 0],
    ['OTP challenge expired', 'EXPIRED', 409, undefined],
    ['OTP challenge has already been used', 'USED_OR_STALE', 409, undefined],
    ['OTP challenge not found', 'CHALLENGE_NOT_FOUND', 409, undefined],
  ])('returns safe typed state for %s', async (message, code, status, attemptsRemaining) => {
    createContactServiceMock.mockReturnValue({
      verifyOtp: vi.fn().mockRejectedValue(otpError(message, code, attemptsRemaining)),
    });

    const response = await verifyOtp(request());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    if (attemptsRemaining !== undefined) {
      expect(body.attemptsRemaining).toBe(attemptsRemaining);
    } else {
      expect(body).not.toHaveProperty('attemptsRemaining');
    }
    expect(JSON.stringify(body)).not.toContain('provider');
  });
});
