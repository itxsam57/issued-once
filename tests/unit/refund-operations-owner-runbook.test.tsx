import { render, screen } from '@testing-library/react';
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
  paymentProviderReference: 'trk_refund_123',
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

afterEach(() => vi.unstubAllGlobals());

test('owner refund runbook exposes provider reference and waits for verified provider reconciliation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ issue }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })));

  render(<IssueDetailPanel issueId={issue.issueId} />);

  expect(await screen.findByText('trk_refund_123')).toBeInTheDocument();
  expect(screen.getByText(/initiate the refund in safepay/i)).toBeInTheDocument();
  expect(screen.getByText(/verified safepay reconciliation/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /refund|mark refunded/i })).not.toBeInTheDocument();
});
