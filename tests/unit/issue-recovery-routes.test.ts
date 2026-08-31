import { beforeEach, expect, test, vi } from 'vitest';
import { IssueRecoveryError } from '@/server/issues/IssueRecoveryService';

const {
  createIssueRecoveryServiceMock,
  requestOtpMock,
  verifyOtpMock,
} = vi.hoisted(() => ({
  createIssueRecoveryServiceMock: vi.fn(),
  requestOtpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}));

vi.mock('@/server/issues/runtimeIssueRecovery', () => ({
  createIssueRecoveryService: createIssueRecoveryServiceMock,
  IssueRecoveryRuntimeUnavailableError: class IssueRecoveryRuntimeUnavailableError extends Error {},
}));

import { POST as requestRecovery } from '@/app/api/issue/recovery/request/route';
import { POST as verifyRecovery } from '@/app/api/issue/recovery/verify/route';

beforeEach(() => {
  vi.clearAllMocks();
  requestOtpMock.mockResolvedValue({
    challengeId: 'challenge-1',
    retryAfterSeconds: 60,
    requestTag: 'CHALLENG',
  });
  verifyOtpMock.mockResolvedValue({ token: 'rotated-secret-session' });
  createIssueRecoveryServiceMock.mockReturnValue({
    requestOtp: requestOtpMock,
    verifyOtp: verifyOtpMock,
  });
});

test('recovery request returns only the neutral challenge-shaped response', async () => {
  const response = await requestRecovery(new Request('https://issuedonce.shop/api/issue/recovery/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-real-ip': '203.0.113.10',
    },
    body: JSON.stringify({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
    }),
  }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    challengeId: 'challenge-1',
    retryAfterSeconds: 60,
    requestTag: 'CHALLENG',
  });
  expect(requestOtpMock).toHaveBeenCalledWith({
    issueCode: 'IO-ABCD-EFGH',
    email: 'buyer@example.com',
    ipKey: '203.0.113.10',
  });
});

test('successful recovery verification sets the existing secure Issue session cookie without returning the token', async () => {
  const response = await verifyRecovery(new Request('https://issuedonce.shop/api/issue/recovery/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
      challengeId: 'challenge-1',
      code: '123456',
    }),
  }));

  expect(response.status).toBe(200);
  expect(await response.clone().json()).toEqual({ restored: true });
  expect(JSON.stringify(await response.json())).not.toContain('rotated-secret-session');
  const setCookie = response.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain('__Host-io_session=rotated-secret-session');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('Secure');
  expect(setCookie).toContain('SameSite=lax');
  expect(setCookie).toContain('Path=/');
});

test('failed recovery verification stays generic and never writes a session cookie', async () => {
  verifyOtpMock.mockRejectedValueOnce(new IssueRecoveryError());

  const response = await verifyRecovery(new Request('https://issuedonce.shop/api/issue/recovery/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      issueCode: 'IO-ABCD-EFGH',
      email: 'buyer@example.com',
      challengeId: 'challenge-1',
      code: '000000',
    }),
  }));

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Issue recovery could not be verified' });
  expect(response.headers.get('set-cookie')).toBeNull();
});

test('malformed recovery input is rejected before runtime lookup', async () => {
  const response = await requestRecovery(new Request('https://issuedonce.shop/api/issue/recovery/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ issueCode: '', email: 'not-an-email' }),
  }));

  expect(response.status).toBe(400);
  expect(createIssueRecoveryServiceMock).not.toHaveBeenCalled();
});
