import { beforeEach, expect, test, vi } from 'vitest';

const { cookiesMock, createReferralServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createReferralServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  createReferralService: createReferralServiceMock,
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));

import { GET as captureReferral } from '@/app/r/[code]/route';
import { POST as applyReferral } from '@/app/api/referrals/apply/route';

const sessionCookie = '__Host-io_session';
const referralCookie = '__Host-io_referral';

beforeEach(() => {
  vi.clearAllMocks();
});

test('public referral link stores only the signed opaque attribution token and redirects into the normal journey', async () => {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({ get: vi.fn(), set });
  const expiresAt = new Date('2026-09-20T10:00:00.000Z');
  const captureLink = vi.fn().mockResolvedValue({
    normalizedCode: 'CREATOR-ONE',
    token: 'opaque.payload.signature',
    expiresAt,
  });
  createReferralServiceMock.mockReturnValue({ captureLink });

  const response = await captureReferral(
    new Request('https://issuedonce.shop/r/creator-one'),
    { params: Promise.resolve({ code: 'creator-one' }) },
  );

  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://issuedonce.shop/begin');
  expect(captureLink).toHaveBeenCalledWith('creator-one');
  expect(set).toHaveBeenCalledWith(referralCookie, 'opaque.payload.signature', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  expect(JSON.stringify(set.mock.calls)).not.toContain('CREATOR-ONE');
  expect(JSON.stringify(set.mock.calls)).not.toMatch(/email|payout/i);
});

test('invalid or paused public code does not create attribution state but still enters the normal journey', async () => {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({ get: vi.fn(), set });
  createReferralServiceMock.mockReturnValue({
    captureLink: vi.fn().mockRejectedValue(new Error('Referral code is unavailable')),
  });

  const response = await captureReferral(
    new Request('https://issuedonce.shop/r/paused-code'),
    { params: Promise.resolve({ code: 'paused-code' }) },
  );

  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://issuedonce.shop/begin');
  expect(set).not.toHaveBeenCalled();
});

test('apply route binds quote and attribution to the anonymous session and lets explicit code override the link token', async () => {
  const get = vi.fn((name: string) => {
    if (name === sessionCookie) return { value: 'session-token' };
    if (name === referralCookie) return { value: 'signed-link-token' };
    return undefined;
  });
  cookiesMock.mockResolvedValue({ get, set: vi.fn() });
  const applyToQuote = vi.fn().mockResolvedValue({
    quoteId: 'quote-discounted',
    grossAmountMinor: 5400,
    discountAmountMinor: 540,
    amountMinor: 4860,
    currency: 'USD',
    applied: true,
    normalizedCode: 'NEWCODE',
  });
  createReferralServiceMock.mockReturnValue({ applyToQuote });

  const response = await applyReferral(new Request('https://issuedonce.shop/api/referrals/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteId: 'quote-gross', explicitCode: ' newcode ', creatorId: 'attacker', discount: 99 }),
  }));

  expect(response.status).toBe(200);
  expect(applyToQuote).toHaveBeenCalledWith({
    sessionToken: 'session-token',
    quoteId: 'quote-gross',
    explicitCode: 'newcode',
    attributionToken: 'signed-link-token',
  });
  expect(await response.json()).toEqual(expect.objectContaining({
    quoteId: 'quote-discounted', grossAmountMinor: 5400, discountAmountMinor: 540, amountMinor: 4860,
  }));
});

test('apply route cannot operate without the anonymous experience session', async () => {
  cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined), set: vi.fn() });
  const response = await applyReferral(new Request('https://issuedonce.shop/api/referrals/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteId: 'quote-gross' }),
  }));

  expect(response.status).toBe(401);
  expect(createReferralServiceMock).not.toHaveBeenCalled();
});
