import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReferralLaunchControl } from '@/components/ops/ReferralLaunchControl';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('cancelling the launch confirmation sends nothing', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'confirm').mockReturnValue(false);

  render(<ReferralLaunchControl />);
  fireEvent.click(screen.getByRole('button', { name: 'SEND LAUNCH EMAILS' }));

  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('confirmed launch sends one bounded owner request and shows only safe counts', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    ok: true,
    considered: 7,
    sent: 5,
    skipped: 1,
    failed: 1,
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  render(<ReferralLaunchControl />);
  fireEvent.click(screen.getByRole('button', { name: 'SEND LAUNCH EMAILS' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/ops/api/referrals/launch-outreach');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    confirmation: 'SEND_LAUNCH_REFERRALS',
    campaign: 'launch-v1',
    limit: 50,
  });
  expect(await screen.findByText(/CONSIDERED \/ 7 · SENT \/ 5 · SKIPPED \/ 1 · FAILED \/ 1/)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/creator@example\.com|ciphertext|api[_-]?key/i);
});
