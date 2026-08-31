import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { IssueStatusView } from '@/components/experience/IssueStatusView';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('a found Issue can send support through the existing Issue session', async () => {
  const message = 'My tracking link has not updated for several days.';
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          found: true,
          issueCode: 'IO-ABCD-EFGH',
          status: 'SHIPPED',
          objectType: 'TEE',
          sizeCode: 'M',
          colorCode: 'BLACK',
          trackingUrl: null,
          trackingNumber: null,
          updatedAt: '2026-08-31T17:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ received: true, issueCode: 'IO-ABCD-EFGH' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', fetchMock);

  const user = userEvent.setup();
  render(<IssueStatusView />);

  expect(await screen.findByText('ISSUE / IO-ABCD-EFGH')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Tell us what happened'), message);
  await user.click(screen.getByRole('button', { name: 'SEND TO SUPPORT' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenLastCalledWith('/api/support', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  });
  expect(await screen.findByText(/support received/i)).toBeInTheDocument();
});
