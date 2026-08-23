import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttentionPanel } from '@/components/ops/AttentionPanel';
import { CustomersPanel } from '@/components/ops/CustomersPanel';
import { DesignerPanel } from '@/components/ops/DesignerPanel';
import { IssuesPanel } from '@/components/ops/IssuesPanel';
import { ManufacturingPanel } from '@/components/ops/ManufacturingPanel';
import { SalesPanel } from '@/components/ops/SalesPanel';
import { SupportPanel } from '@/components/ops/SupportPanel';
import { SystemPanel } from '@/components/ops/SystemPanel';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';

function response(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function salesSnapshot(orders: number) {
  return {
    days: 30,
    currency: 'USD',
    grossMinor: orders * 3200,
    refundedMinor: 0,
    netAfterRefundMinor: orders * 3200,
    paidOrders: orders,
    averageOrderMinor: 3200,
    failedPayments: 0,
    exceptionPayments: 0,
    byProduct: [{ key: 'tee', orders }],
    bySize: [{ key: 'M', orders }],
    byColor: [{ key: 'Black', orders }],
    byCountry: [{ key: 'PK', orders }],
    timing: { averageHoursStartToPaid: 0.5, averageHoursPaidToProduction: null, averageHoursProductionToDelivered: null },
    funnel: { started: orders, answered: orders, physical: orders, verified: orders, shipping: orders, checkout: orders, paid: orders },
  };
}

function issueRow(issueCode: string) {
  return {
    issueId: issueCode === 'IO-LIVE-NEW1'
      ? '22222222-2222-4222-8222-222222222222'
      : '11111111-1111-4111-8111-111111111111',
    issueCode,
    status: 'DESIGN_REVIEW',
    objectType: 'tee',
    sizeCode: 'M',
    colorCode: 'Black',
    amountMinor: 3200,
    currency: 'USD',
    paymentStatus: 'PAID',
    designState: 'REVIEW',
    manufacturingState: null,
    providerOrderId: null,
    trackingNumber: null,
    paymentExceptionCode: null,
    updatedAt: '2026-08-23T08:00:00.000Z',
  };
}

function designQueueItem(designState: 'INTERPRETING' | 'REVIEW') {
  return {
    issueId: '33333333-3333-4333-8333-333333333333',
    issueCode: 'IO-DESIGN-LIVE',
    issueStatus: designState === 'REVIEW' ? 'DESIGN_REVIEW' : 'BEING_INTERPRETED',
    objectType: 'tee',
    sizeCode: 'M',
    colorCode: 'Black',
    designJobId: '44444444-4444-4444-8444-444444444444',
    designState,
    artworkUrl: null,
    width: null,
    height: null,
    provider: 'OPENAI',
    model: 'image',
    candidateCount: 0,
    updatedAt: '2026-08-23T08:00:00.000Z',
  };
}

function readiness(state: 'missing' | 'configured') {
  return {
    checkedAt: '2026-08-23T08:00:00.000Z',
    readyForSandbox: state === 'configured',
    readyForProduction: false,
    checks: [{ key: 'queues', label: 'Durable queues', state, detail: state === 'configured' ? 'Queue consumers declared.' : 'Queue consumers missing.' }],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Owner OS live rooms', () => {
  it('refreshes Attention every 10 seconds while mounted', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response({
      items: fresh ? [{
        kind: 'SUPPORT_AGING', priority: 1, issueId: null, issueCode: 'IO-ATTN-LIVE',
        targetId: 'support-live', detail: 'A fresh support item arrived.', createdAt: '2026-08-23T08:00:00.000Z',
      }] : [],
    })));
    render(<AttentionPanel onNavigate={() => undefined} />);
    await flush();
    expect(screen.queryByText('A fresh support item arrived.')).not.toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await flush();
    expect(screen.getByText('A fresh support item arrived.')).toBeInTheDocument();
  });

  it('refreshes Sales every 20 seconds without changing its selected window', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response(salesSnapshot(fresh ? 2 : 1))));
    render(<SalesPanel />);
    await flush();
    const metric = screen.getByText('PAID ORDERS').closest('article');
    expect(metric).not.toBeNull();
    expect(within(metric!).getByText('1')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    await flush();
    expect(within(metric!).getByText('2')).toBeInTheDocument();
    expect(screen.getByLabelText('Sales window')).toHaveValue('30');
  });

  it('refreshes the first Issues page every 20 seconds', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response({
      items: [issueRow(fresh ? 'IO-LIVE-NEW1' : 'IO-LIVE-OLD1')],
      nextCursor: null,
    })));
    render(<IssuesPanel />);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await flush();
    expect(screen.getByText('IO-LIVE-OLD1')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    await flush();
    expect(screen.getByText('IO-LIVE-NEW1')).toBeInTheDocument();
    expect(screen.queryByText('IO-LIVE-OLD1')).not.toBeInTheDocument();
  });

  it('refreshes Customers every 30 seconds', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response({
      items: [{
        contactAlias: fresh ? 'CONTACT LIVE2222' : 'CONTACT OLD11111',
        issueCount: 1, currency: 'USD', paidMinor: 3200, refundedIssues: 0,
        activeDeliveries: 0, supportCount: 0, lastSeenAt: '2026-08-23T08:00:00.000Z',
      }],
      nextCursor: null,
    })));
    render(<CustomersPanel />);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await flush();
    expect(screen.getByText('CONTACT OLD11111')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await flush();
    expect(screen.getByText('CONTACT LIVE2222')).toBeInTheDocument();
  });

  it('refreshes Support every 15 seconds', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response({
      items: [{
        requestId: '55555555-5555-4555-8555-555555555555',
        issueId: '66666666-6666-4666-8666-666666666666',
        issueCode: fresh ? 'IO-SUPPORT-NEW' : 'IO-SUPPORT-OLD',
        issueStatus: 'DESIGN_REVIEW', status: 'OPEN',
        createdAt: '2026-08-23T08:00:00.000Z', updatedAt: '2026-08-23T08:00:00.000Z',
        noteCount: 0, failedNotifications: [],
      }],
    })));
    render(<SupportPanel />);
    await flush();
    expect(screen.getByText('IO-SUPPORT-OLD')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await flush();
    expect(screen.getByText('IO-SUPPORT-NEW')).toBeInTheDocument();
  });

  it('refreshes Manufacturing every 15 seconds without triggering any production action', async () => {
    let fresh = false;
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => response({
      confirmArmed: false,
      items: [{
        issueId: '77777777-7777-4777-8777-777777777777',
        issueCode: 'IO-FACTORY-LIVE', issueStatus: 'MANUFACTURING_DRAFT',
        objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
        designState: 'APPROVED', manufacturingState: fresh ? 'IN_PRODUCTION' : 'DRAFT',
        providerOrderId: 'pf-draft-live', providerStatus: fresh ? 'inprocess' : 'draft',
        trackingNumber: null, updatedAt: '2026-08-23T08:00:00.000Z',
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ManufacturingPanel />);
    await flush();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await flush();
    expect(screen.getByText('IN_PRODUCTION')).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => !init || init.method !== 'POST')).toBe(true);
  });

  it('refreshes System readiness every 15 seconds', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn(() => response(readiness(fresh ? 'configured' : 'missing'))));
    render(<SystemPanel />);
    await flush();
    expect(screen.getByText('MISSING')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await flush();
    expect(screen.getByText('CONFIGURED')).toBeInTheDocument();
  });

  it('refreshes Designer queue/readiness every 15 seconds while mounted', async () => {
    let fresh = false;
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input);
      if (url === '/ops/api/designer') return response({ items: [designQueueItem(fresh ? 'REVIEW' : 'INTERPRETING')] });
      if (url === '/ops/api/designer/policy') return response({ source: 'ACTIVE', version: 3, policy: DEFAULT_DESIGN_POLICY });
      if (url === '/ops/api/readiness') return response({
        checkedAt: '2026-08-23T08:00:00.000Z', readyForSandbox: true, readyForProduction: false,
        checks: [
          { key: 'openai', label: 'OpenAI design models', state: 'ready', detail: 'Models accessible.' },
          { key: 'blob', label: 'Private artwork storage', state: 'ready', detail: 'Blob accessible.' },
          { key: 'queues', label: 'Durable queues', state: 'configured', detail: 'Queues configured.' },
          { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Production disabled.' },
        ],
      });
      throw new Error(`Unexpected fetch ${url}`);
    }));
    render(<DesignerPanel />);
    await flush();
    expect(screen.getByText('INTERPRETING')).toBeInTheDocument();
    fresh = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await flush();
    expect(screen.getByText('REVIEW')).toBeInTheDocument();
  });
});