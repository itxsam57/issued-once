import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HomePanel } from '@/components/ops/HomePanel';

function dashboard(orders: number, issueCode: string) {
  return {
    sales: {
      currency: 'USD',
      today: { orders, grossMinor: orders * 3200 },
      sevenDays: { orders, grossMinor: orders * 3200 },
      thirtyDays: { orders, grossMinor: orders * 3200 },
      lifetime: { orders, grossMinor: orders * 3200 },
      refundedMinor: 0,
      averageOrderMinor: 3200,
    },
    operations: {
      paidIssues: orders,
      designing: 0,
      review: orders,
      production: 0,
      transit: 0,
      delivered: 0,
    },
    attention: {
      paymentExceptions: 0,
      designFailures: 0,
      manufacturingFailures: 0,
      notificationFailures: 0,
      supportOpen: 0,
    },
    activity: [{
      issueCode,
      eventType: 'PAYMENT_RECEIVED',
      source: 'SAFEPAY',
      createdAt: '2026-08-23T05:17:00.000Z',
    }],
  };
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('Home refreshes canonical payment truth while mounted without a page reload', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(dashboard(2, 'IO-OLD-0001')))
    .mockResolvedValueOnce(response(dashboard(3, 'IO-GUUM-8UR9')));
  vi.stubGlobal('fetch', fetchMock);

  render(<HomePanel />);
  await flush();
  expect(screen.getByText('IO-OLD-0001')).toBeInTheDocument();
  expect(screen.queryByText('IO-GUUM-8UR9')).not.toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText('IO-GUUM-8UR9')).toBeInTheDocument();
  expect(screen.getByText(/UPDATED /i)).toBeInTheDocument();
});
