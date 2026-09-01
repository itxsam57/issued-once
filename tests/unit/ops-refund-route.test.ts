import { beforeEach, expect, test, vi } from 'vitest';

const {
  hasOpsSessionMock,
  createOpsRefundServiceMock,
  reconcileMock,
} = vi.hoisted(() => ({
  hasOpsSessionMock: vi.fn(),
  createOpsRefundServiceMock: vi.fn(),
  reconcileMock: vi.fn(),
}));

vi.mock('@/server/ops/opsRequest', () => ({ hasOpsSession: hasOpsSessionMock }));
vi.mock('@/server/ops/runtimeOwnerOs', () => ({
  createOpsRefundService: createOpsRefundServiceMock,
}));
vi.mock('@/server/ops/runtimeOps', () => ({
  OpsRuntimeUnavailableError: class OpsRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/payments/runtimePayments', () => ({
  PaymentRuntimeUnavailableError: class PaymentRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/issues/runtimeIssues', () => ({
  IssueRuntimeUnavailableError: class IssueRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/referrals/runtimeReferrals', () => ({
  ReferralRuntimeUnavailableError: class ReferralRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/ops/api/issues/[issueId]/refund/reconcile/route';

const issueId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  hasOpsSessionMock.mockResolvedValue(true);
  reconcileMock.mockResolvedValue({ kind: 'pending', issueCode: 'IO-ABCD-EFGH' });
  createOpsRefundServiceMock.mockReturnValue({ reconcile: reconcileMock });
});

test('unauthenticated requests never reach refund reconciliation', async () => {
  hasOpsSessionMock.mockResolvedValue(false);

  const response = await POST(new Request(`https://issuedonce.shop/ops/api/issues/${issueId}/refund/reconcile`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH' }),
  }), { params: Promise.resolve({ issueId }) });

  expect(response.status).toBe(401);
  expect(createOpsRefundServiceMock).not.toHaveBeenCalled();
});

test('owner route forwards only Issue identity and confirmation, never browser money truth', async () => {
  const response = await POST(new Request(`https://issuedonce.shop/ops/api/issues/${issueId}/refund/reconcile`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH',
      amountMinor: 1,
      currency: 'XXX',
      providerReference: 'browser-forged-reference',
    }),
  }), { params: Promise.resolve({ issueId }) });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ kind: 'pending', issueCode: 'IO-ABCD-EFGH' });
  expect(reconcileMock).toHaveBeenCalledWith({
    issueId,
    confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH',
  });
});
