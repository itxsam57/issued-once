import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_DESIGN_POLICY } from '@/server/design/DesignPolicy';
import { DesignerPanel } from '@/components/ops/DesignerPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const issueId = '11111111-1111-4111-8111-111111111111';

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

test('Designer exposes global/per-Issue policy, private reveal, manual upload and structured feedback', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/ops/api/designer' && method === 'GET') return response({ items: [{
      issueId,
      issueCode: 'IO-TEST-001',
      issueStatus: 'DESIGN_REVIEW',
      objectType: 'shirt',
      sizeCode: 'M',
      colorCode: 'black',
      designJobId: '22222222-2222-4222-8222-222222222222',
      designState: 'REVIEW',
      artworkUrl: 'https://example.com/art.png',
      width: 4500,
      height: 5400,
      provider: 'OPENAI',
      model: 'image',
      candidateCount: 1,
      updatedAt: new Date().toISOString(),
    }] });
    if (url === '/ops/api/designer/policy' && method === 'GET') {
      return response({ source: 'ACTIVE', version: 3, policy: DEFAULT_DESIGN_POLICY });
    }
    if (url === `/ops/api/designer/${issueId}/candidates`) return response({ items: [] });
    if (url === `/ops/api/designer/${issueId}/policy` && method === 'GET') {
      return response({ globalVersion: 3, override: null, policy: DEFAULT_DESIGN_POLICY });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  });

  render(<DesignerPanel />);

  expect(await screen.findByText('GLOBAL DESIGN MODE')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /global design mode/i })).toHaveValue('HYBRID');

  await userEvent.click(await screen.findByRole('button', { name: /IO-TEST-001/i }));

  expect(await screen.findByRole('combobox', { name: /this issue mode/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reveal answers/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/manual artwork png/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /upload png/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /too busy/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /wrong mood/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/custom design instruction/i)).toBeInTheDocument();

  expect(fetchMock).toHaveBeenCalledWith('/ops/api/designer/policy', expect.objectContaining({ cache: 'no-store' }));
  expect(fetchMock).toHaveBeenCalledWith(`/ops/api/designer/${issueId}/policy`, expect.objectContaining({ cache: 'no-store' }));
});
