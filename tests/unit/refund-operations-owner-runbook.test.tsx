import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { IssueDetailPanel } from '@/components/ops/IssueDetailPanel';

const issue = {
  issueId: '11111111-1111-1111-1111-111111111111',
  issueCode: 'IO-ABCD-EFGH',
  status: 'PAID',
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'black',
  amountMinor: 5400,
  currency: 'USD',
  paymentStatus: 'PAID',
  paymentProvider: 'SAFEPAY',
  paymentProviderReference: 'track_refund_123',
  paymentExceptionCode: null,
  designState: null,
  artworkWidth: null,
  artworkHeight: null,
  designProvider: null,
  designModel: null,
  manufacturingState: null,
  providerOrderId: null,
  providerStatus: null,
  trackingNumber: null,
  trackingUrl: null,
  privacy: {
    verifiedEmail: true,
    shipping: true,
    answers: true,
    privateBrief: false,
    supportMessage: false,
  },
  timeline: [],
  notifications: [],
  support: [],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

test('owner refund runbook explicitly limits Safepay initiation to a full refund and waits for verified provider reconciliation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({ issue })));

  render(<IssueDetailPanel issueId={issue.issueId} />);

  expect(await screen.findByText(/safepay reference:/i)).toHaveTextContent('track_refund_123');
  expect(screen.getByText(/initiate the full refund in safepay/i)).toBeInTheDocument();
  expect(screen.getByText(/verified safepay reconciliation/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /refund|mark refunded/i })).not.toBeInTheDocument();
});

test('owner can request provider-derived refund reconciliation without supplying local refund truth', async () => {
  const user = userEvent.setup();
  const reconcilePath = `/ops/api/issues/${issue.issueId}/refund/reconcile`;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `/ops/api/issues/${issue.issueId}`) return json({ issue });
    if (url === reconcilePath) {
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toEqual({ confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH' });
      expect(body).not.toHaveProperty('amountMinor');
      expect(body).not.toHaveProperty('currency');
      expect(body).not.toHaveProperty('status');
      expect(body).not.toHaveProperty('providerReference');
      return json({ kind: 'pending', issueCode: issue.issueCode });
    }
    throw new Error(`Unexpected Owner OS request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<IssueDetailPanel issueId={issue.issueId} />);

  expect(await screen.findByText(/safepay reference:/i)).toBeInTheDocument();
  const confirmation = screen.getByLabelText(/safepay reconciliation confirmation/i);
  const verify = screen.getByRole('button', { name: 'VERIFY SAFEPAY TRUTH' });
  expect(verify).toBeDisabled();

  await user.type(confirmation, 'VERIFY SAFEPAY IO-ABCD-EFG');
  expect(verify).toBeDisabled();
  await user.type(confirmation, 'H');
  expect(verify).toBeEnabled();
  await user.click(verify);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    reconcilePath,
    expect.objectContaining({ method: 'POST' }),
  ));
  expect(await screen.findByText(/local payment truth is unchanged/i)).toBeInTheDocument();
});
