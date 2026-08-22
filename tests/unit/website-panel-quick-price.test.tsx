import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { WebsitePanel } from '@/components/ops/WebsitePanel';

const state = {
  catalog: {
    source: 'ACTIVE',
    version: 4,
    payload: {
      currency: 'USD',
      products: {
        tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] },
        hat: { slug: 'issued-hat', variants: [{ id: 'hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 4200, available: true }] },
        tote: { slug: 'issued-tote', variants: [{ id: 'tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3800, available: true }] },
      },
    },
  },
  questions: [],
};

afterEach(() => vi.unstubAllGlobals());

test('quick price publishes a major-unit future-sale price for one product without editing variants individually', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version: 5 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...state, catalog: { ...state.catalog, version: 5 } }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<WebsitePanel />);

  expect(await screen.findByRole('heading', { name: 'What the next customer can receive.' })).toBeInTheDocument();
  expect(screen.getByText(/existing quotes and Issues stay frozen/i)).toBeInTheDocument();
  expect(screen.getByLabelText('TEE quick price')).toHaveValue('54.00');
  expect(screen.getByLabelText('HAT quick price')).toHaveValue('42.00');
  expect(screen.getByLabelText('TOTE quick price')).toHaveValue('38.00');

  await user.clear(screen.getByLabelText('TEE quick price'));
  await user.type(screen.getByLabelText('TEE quick price'), '61.00');
  await user.click(screen.getByRole('button', { name: 'PUBLISH TEE PRICE' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/ops/api/website/catalog/price', expect.objectContaining({
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productKey: 'tee', amountMinor: 6100, currency: 'USD' }),
  })));
  expect(await screen.findByText(/TEE price published/i)).toBeInTheDocument();
});

test('quick price rejects non-money input before a publication request', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<WebsitePanel />);
  await screen.findByLabelText('TEE quick price');
  await user.clear(screen.getByLabelText('TEE quick price'));
  await user.type(screen.getByLabelText('TEE quick price'), '61.999');
  await user.click(screen.getByRole('button', { name: 'PUBLISH TEE PRICE' }));

  expect(screen.getByRole('alert')).toHaveTextContent(/valid price/i);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
