import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { WebsitePanel } from '@/components/ops/WebsitePanel';

const state = {
  catalog: { source: 'ACTIVE', version: 4, payload: { currency: 'USD', products: {
    tee: { slug: 'issued-tee', variants: [
      { id: 'tee-m-black', size: 'M', colorName: 'Black', amountMinor: 5400, available: true },
      { id: 'tee-xl-black', size: 'XL', colorName: 'Black', amountMinor: 5900, available: true },
    ] },
    hat: { slug: 'issued-hat', variants: [{ id: 'hat-os-black', size: 'OS', colorName: 'Black', amountMinor: 4200, available: true }] },
    tote: { slug: 'issued-tote', variants: [{ id: 'tote-os-bone', size: 'OS', colorName: 'Bone', amountMinor: 3800, available: true }] },
  } } }, questions: [],
};

afterEach(() => vi.unstubAllGlobals());

test('mixed variant prices use major currency units and publish as minor units', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version: 5 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<WebsitePanel />);
  const price = await screen.findByLabelText('TEE M Black price');
  expect(price).toHaveValue('54.00');
  await user.clear(price);
  await user.type(price, '61.50');
  expect(screen.getByText(/UNSAVED CATALOG CHANGES/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /PUBLISH CATALOG CHANGES/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/ops/api/website/catalog', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('"amountMinor":6150'),
  })));
});

test('mixed variant price rejects more than two decimal places', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<WebsitePanel />);
  const price = await screen.findByLabelText('TEE M Black price');
  await user.clear(price);
  await user.type(price, '61.999');
  await user.click(screen.getByRole('button', { name: /PUBLISH CATALOG CHANGES/i }));

  expect(screen.getByRole('alert')).toHaveTextContent(/valid price/i);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
