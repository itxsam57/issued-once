import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { OpsConsole } from '@/components/ops/OpsConsole';

const issue = {
  issueId: 'a45f40f8-3819-4ea3-b696-595e91f63e3a',
  issueCode: 'IO-ABCD-EFGH',
  status: 'DESIGN_REVIEW',
  objectType: 'tee',
  sizeCode: 'M',
  colorCode: 'Black',
  amountMinor: 5400,
  currency: 'USD',
  designJobId: 'design-1',
  designState: 'REVIEW',
  artworkUrl: 'https://blob.example/issue.png?signed=ops',
  artworkWidth: 1024,
  artworkHeight: 1536,
  manufacturingJobId: null,
  manufacturingState: null,
  providerOrderId: null,
  trackingNumber: null,
  updatedAt: '2026-08-19T06:00:00.000Z',
};

const readiness = {
  checkedAt: '2026-08-19T06:00:00.000Z',
  readyForSandbox: false,
  readyForProduction: false,
  checks: [
    { key: 'database', label: 'Neon database', state: 'ready', detail: 'Read-only database ping succeeded.' },
    { key: 'safepay', label: 'Safepay', state: 'missing', detail: 'Safepay environment, API key, and webhook secret are required.' },
    { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Printful production confirmation is disabled by default.' },
  ],
};

function mockOpsFetch(issues = [issue]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/ops/api/readiness')) {
      return new Response(JSON.stringify(readiness), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ issues }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }));
}

afterEach(() => vi.unstubAllGlobals());

test('shows launch readiness and production truth without raw answers, contact or shipping data', async () => {
  mockOpsFetch();
  render(<OpsConsole />);

  expect(await screen.findByText('LAUNCH / NOT READY')).toBeInTheDocument();
  expect(screen.getByText('Neon database')).toBeInTheDocument();
  expect(screen.getByText('READY')).toBeInTheDocument();
  expect(screen.getByText('Safepay')).toBeInTheDocument();
  expect(screen.getByText('MISSING')).toBeInTheDocument();

  expect(await screen.findByText('ISSUE / IO-ABCD-EFGH')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Production artwork for IO-ABCD-EFGH' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'APPROVE ART' })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/sam@example|street|favourite book|private answer/i);
});

test('production confirmation remains disabled until the exact public Issue Code phrase is typed', async () => {
  const user = userEvent.setup();
  mockOpsFetch([{ ...issue, status: 'MANUFACTURING_DRAFT', designState: 'APPROVED', manufacturingJobId: 'mfg-1', manufacturingState: 'DRAFT', providerOrderId: '987654' }]);
  render(<OpsConsole />);

  const button = await screen.findByRole('button', { name: 'CONFIRM PRODUCTION' });
  expect(button).toBeDisabled();
  await user.type(screen.getByLabelText('Production confirmation for IO-ABCD-EFGH'), 'CONFIRM IO-ABCD-EFGH');
  await waitFor(() => expect(button).not.toBeDisabled());
});
