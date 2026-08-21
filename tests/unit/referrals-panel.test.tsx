import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReferralsPanel } from '@/components/ops/ReferralsPanel';

const creatorId = '55555555-5555-4555-8555-555555555555';
const rules = {
  customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
  creatorReward: { mode: 'PERCENT', basisPoints: 2000 },
  payoutCadence: 'THRESHOLD',
  payoutThresholdMinor: 2500,
  attributionWindowDays: 30,
};

const snapshot = {
  creators: [{
    creatorId,
    displayName: 'Creator One',
    code: 'CREATOR-ONE',
    referralPath: '/r/CREATOR-ONE',
    active: true,
    ruleVersionId: 'rule-2',
    ruleVersion: 2,
    rules,
    salesCount: 4,
    balances: [{ currency: 'USD', pendingMinor: 972, availableMinor: 2916, paidOutMinor: 1000, reversedMinor: 500, payoutReady: true }],
  }],
  payouts: [{
    payoutId: 'payout-1', creatorId, currency: 'USD', requestedAmountMinor: 2916, conversionCount: 3,
    status: 'REQUESTED', requestedAt: '2026-08-21T10:00:00.000Z', paidAt: null,
  }],
};

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

test('shows safe creator economics and controls while payout plaintext stays hidden until reason-gated reveal', async () => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => response(snapshot))
    .mockImplementationOnce((_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ action: 'REVEAL', payoutId: 'payout-1', reason: 'Verify destination before settlement' });
      return response({ value: { method: 'bank', accountName: 'Creator One', accountRef: 'PK00-PRIVATE' } });
    });
  vi.stubGlobal('fetch', fetchMock);

  render(<ReferralsPanel />);

  expect(await screen.findByRole('heading', { name: 'Who is bringing people in.' })).toBeInTheDocument();
  expect(await screen.findByText('CREATOR-ONE', { exact: true })).toBeInTheDocument();
  expect(screen.getByText(/available/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'NEW CREATOR' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'EDIT RULES' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'PAUSE CREATOR' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'REQUEST PAYOUT' })).toBeInTheDocument();
  expect(screen.queryByText(/PK00-PRIVATE|creator@example/i)).not.toBeInTheDocument();

  const reveal = screen.getByRole('button', { name: 'REVEAL PAYOUT DETAILS' });
  expect(reveal).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason to reveal payout details'), { target: { value: 'Verify destination before settlement' } });
  expect(reveal).toBeEnabled();
  fireEvent.click(reveal);

  await waitFor(() => expect(screen.getByText(/PK00-PRIVATE/)).toBeInTheDocument());
});
