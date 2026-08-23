// @vitest-environment node

import { beforeEach, expect, test, vi } from 'vitest';

const { hasOpsSessionMock, createOpsReferralServiceMock } = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsReferralServiceMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({ createOpsReferralService: createOpsReferralServiceMock }));

import { GET as getReferrals, POST as postReferrals } from '@/app/ops/api/referrals/route';
import { PATCH as patchCreator, PUT as putCreator } from '@/app/ops/api/referrals/[creatorId]/route';
import { POST as postPayouts } from '@/app/ops/api/referrals/payouts/route';

const creatorId = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ creatorId }) };
const rules = {
  customerDiscount: { mode: 'PERCENT' as const, basisPoints: 1000 },
  creatorReward: { mode: 'FIXED' as const, amountMinor: 500 },
  payoutCadence: 'THRESHOLD' as const,
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};

beforeEach(() => vi.clearAllMocks());

function request(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('referral list is owner-authenticated before runtime construction and normal payloads contain no private creator data', async () => {
  hasOpsSessionMock.mockResolvedValue(false);
  const unauthorized = await getReferrals();
  expect(unauthorized.status).toBe(401);
  expect(createOpsReferralServiceMock).not.toHaveBeenCalled();

  hasOpsSessionMock.mockResolvedValue(true);
  createOpsReferralServiceMock.mockReturnValue({
    listCreators: vi.fn().mockResolvedValue([{ creatorId, displayName: 'Creator One', code: 'CREATOR-ONE', referralPath: '/r/CREATOR-ONE', active: true, ruleVersionId: 'rule-1', ruleVersion: 1, rules, salesCount: 2, balances: [{ currency: 'USD', pendingMinor: 500, availableMinor: 2500, paidOutMinor: 0, reversedMinor: 0, payoutReady: true }] }]),
    listPayouts: vi.fn().mockResolvedValue([{ payoutId: 'payout-1', creatorId, currency: 'USD', requestedAmountMinor: 2500, conversionCount: 2, status: 'REQUESTED', requestedAt: new Date('2026-08-21T10:00:00.000Z'), paidAt: null }]),
  });
  const response = await getReferrals();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/no-store/);
  const body = await response.json();
  expect(body.creators[0]).toMatchObject({ code: 'CREATOR-ONE', referralPath: '/r/CREATOR-ONE' });
  expect(body.payouts[0]).toMatchObject({ payoutId: 'payout-1', requestedAt: '2026-08-21T10:00:00.000Z' });
  expect(JSON.stringify(body)).not.toMatch(/email|ciphertext|accountRef|PK00-PRIVATE/i);
});

test('creator create, immutable-rule edit, and active-state change delegate only after owner auth', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const createCreator = vi.fn().mockResolvedValue({ creatorId, ruleVersionId: 'rule-1' });
  const updateCreator = vi.fn().mockResolvedValue({ creatorId, ruleVersionId: 'rule-2', ruleVersion: 2 });
  const setCreatorActive = vi.fn().mockResolvedValue({ creatorId, active: false });
  createOpsReferralServiceMock.mockReturnValue({ createCreator, updateCreator, setCreatorActive });

  const created = await postReferrals(request('https://issuedonce.shop/ops/api/referrals', 'POST', {
    displayName: 'Creator One', email: 'creator@example.com', code: 'creator-one', rules,
  }));
  expect(created.status).toBe(200);
  expect(createCreator).toHaveBeenCalledWith({ displayName: 'Creator One', email: 'creator@example.com', code: 'creator-one', rules });

  const updated = await putCreator(request(`https://issuedonce.shop/ops/api/referrals/${creatorId}`, 'PUT', {
    displayName: 'Creator One Updated', code: 'creator-one', rules,
  }), context);
  expect(updated.status).toBe(200);
  expect(updateCreator).toHaveBeenCalledWith(creatorId, { displayName: 'Creator One Updated', code: 'creator-one', rules });

  const paused = await patchCreator(request(`https://issuedonce.shop/ops/api/referrals/${creatorId}`, 'PATCH', { active: false }), context);
  expect(paused.status).toBe(200);
  expect(setCreatorActive).toHaveBeenCalledWith(creatorId, false);
});

test('payout route keeps request, private reveal, and settlement as explicit owner actions', async () => {
  hasOpsSessionMock.mockResolvedValue(true);
  const requestPayout = vi.fn().mockResolvedValue({ payoutId: 'payout-1', creatorId, currency: 'USD', requestedAmountMinor: 2500, conversionCount: 2, status: 'REQUESTED' });
  const revealPayoutDetails = vi.fn().mockResolvedValue({ method: 'bank', accountRef: 'PK00-PRIVATE' });
  const markPayoutPaid = vi.fn().mockResolvedValue({ payoutId: 'payout-1', creatorId, currency: 'USD', paidAmountMinor: 2500, conversionCount: 2, status: 'PAID' });
  createOpsReferralServiceMock.mockReturnValue({ requestPayout, revealPayoutDetails, markPayoutPaid });

  const requested = await postPayouts(request('https://issuedonce.shop/ops/api/referrals/payouts', 'POST', {
    action: 'REQUEST', creatorId, currency: 'USD', details: { method: 'bank', accountRef: 'PK00-PRIVATE' }, reason: 'Monthly settlement',
  }));
  expect(requested.status).toBe(200);
  expect(requestPayout).toHaveBeenCalledWith({ creatorId, currency: 'USD', details: { method: 'bank', accountRef: 'PK00-PRIVATE' }, reason: 'Monthly settlement' });

  const revealed = await postPayouts(request('https://issuedonce.shop/ops/api/referrals/payouts', 'POST', {
    action: 'REVEAL', payoutId: 'payout-1', reason: 'Verify destination',
  }));
  expect(revealed.status).toBe(200);
  expect(revealed.headers.get('cache-control')).toMatch(/no-store/);
  await expect(revealed.json()).resolves.toEqual({ value: { method: 'bank', accountRef: 'PK00-PRIVATE' } });
  expect(revealPayoutDetails).toHaveBeenCalledWith({ payoutId: 'payout-1', reason: 'Verify destination' });

  const settled = await postPayouts(request('https://issuedonce.shop/ops/api/referrals/payouts', 'POST', {
    action: 'MARK_PAID', payoutId: 'payout-1', reason: 'Transfer confirmed',
  }));
  expect(settled.status).toBe(200);
  expect(markPayoutPaid).toHaveBeenCalledWith({ payoutId: 'payout-1', reason: 'Transfer confirmed' });

  const invalid = await postPayouts(request('https://issuedonce.shop/ops/api/referrals/payouts', 'POST', { action: 'UNKNOWN' }));
  expect(invalid.status).toBe(400);
});
