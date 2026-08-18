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
  artworkUrl: 'https://blob.example/issue.png',
  artworkWidth: 1024,
  artworkHeight: 1536,
  manufacturingJobId: null,
  manufacturingState: null,
  providerOrderId: null,
  trackingNumber: null,
  updatedAt: '2026-08-19T06:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

test('shows production truth and artwork without raw answers, contact or shipping data', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ issues: [issue] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })));
  render(<OpsConsole />);

  expect(await screen.findByText('ISSUE / IO-ABCD-EFGH')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Production artwork for IO-ABCD-EFGH' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'APPROVE ART' })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/sam@example|street|favourite book|private answer/i);
});

test('production confirmation remains disabled until the exact public Issue Code phrase is typed', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    issues: [{ ...issue, status: 'MANUFACTURING_DRAFT', designState: 'APPROVED', manufacturingJobId: 'mfg-1', manufacturingState: 'DRAFT', providerOrderId: '987654' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })));
  render(<OpsConsole />);

  const button = await screen.findByRole('button', { name: 'CONFIRM PRODUCTION' });
  expect(button).toBeDisabled();
  await user.type(screen.getByLabelText('Production confirmation for IO-ABCD-EFGH'), 'CONFIRM IO-ABCD-EFGH');
  await waitFor(() => expect(button).not.toBeDisabled());
});
