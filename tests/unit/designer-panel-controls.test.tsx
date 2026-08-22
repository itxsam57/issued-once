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

function queueItem(designState: 'REVIEW' | 'APPROVED' = 'REVIEW') {
  return {
    issueId,
    issueCode: 'IO-TEST-001',
    issueStatus: designState === 'APPROVED' ? 'DESIGN_APPROVED' : 'DESIGN_REVIEW',
    objectType: 'shirt',
    sizeCode: 'M',
    colorCode: 'black',
    designJobId: '22222222-2222-4222-8222-222222222222',
    designState,
    artworkUrl: 'https://example.com/art.png',
    width: 4500,
    height: 5400,
    provider: 'OPENAI',
    model: 'image',
    candidateCount: 1,
    updatedAt: new Date().toISOString(),
  };
}

function readiness() {
  return {
    checkedAt: new Date().toISOString(),
    readyForSandbox: false,
    readyForProduction: false,
    checks: [
      { key: 'openai', label: 'OpenAI design models', state: 'ready', detail: 'Models accessible.' },
      { key: 'blob', label: 'Private artwork storage', state: 'ready', detail: 'Private Blob signing check succeeded.' },
      { key: 'queues', label: 'Durable queues', state: 'configured', detail: 'Queue consumers declared.' },
      { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Printful production confirmation is disabled by default.' },
    ],
  };
}

function mockDesignerFetch(designState: 'REVIEW' | 'APPROVED' = 'REVIEW') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/ops/api/designer' && method === 'GET') return response({ items: [queueItem(designState)] });
    if (url === '/ops/api/designer/policy' && method === 'GET') {
      return response({ source: 'ACTIVE', version: 3, policy: DEFAULT_DESIGN_POLICY });
    }
    if (url === '/ops/api/readiness' && method === 'GET') return response(readiness());
    if (url === `/ops/api/designer/${issueId}/candidates` && method === 'GET') return response({ items: [] });
    if (url === `/ops/api/designer/${issueId}/policy` && method === 'GET') {
      return response({ globalVersion: 3, override: null, policy: DEFAULT_DESIGN_POLICY });
    }
    if (url === '/ops/api/manufacturing/create-draft' && method === 'POST') {
      return response({ ok: true, manufacturing: { state: 'DRAFT', providerOrderId: 'draft-1' } });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  });
}

test('Designer exposes complete global/per-Issue policy, readiness, private reveal, manual upload and structured feedback', async () => {
  const fetchMock = mockDesignerFetch('REVIEW');

  render(<DesignerPanel />);

  expect(await screen.findByText('GLOBAL DESIGN MODE')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /global design mode/i })).toHaveValue('HYBRID');
  expect(screen.getByRole('combobox', { name: /manual upload approval/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /answer reveal default/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /factory confirmation policy/i })).toBeInTheDocument();
  expect(await screen.findByText(/AI AUTOMATION READY/i)).toBeInTheDocument();
  expect(screen.getByText(/MANUAL ARTWORK READY/i)).toBeInTheDocument();
  expect(screen.getByText(/FACTORY CHARGE SWITCH SAFE/i)).toBeInTheDocument();

  await userEvent.click(await screen.findByRole('button', { name: /IO-TEST-001/i }));

  expect(await screen.findByRole('combobox', { name: /this issue mode/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue approval/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue reject behavior/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue manual upload approval/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue answer reveal/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue manufacturing handoff/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /this issue factory confirmation/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reveal answers/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/manual artwork png/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /upload png/i })).toBeInTheDocument();

  for (const reason of ['TOO BUSY', 'TOO LITERAL', 'WEAK CONCEPT', 'WRONG MOOD', 'TYPOGRAPHY', 'PLACEMENT', 'NOT WEARABLE', 'OTHER']) {
    expect(screen.getByRole('button', { name: new RegExp(reason, 'i') })).toBeInTheDocument();
  }
  expect(screen.getByLabelText(/custom design instruction/i)).toBeInTheDocument();

  expect(fetchMock).toHaveBeenCalledWith('/ops/api/designer/policy', expect.objectContaining({ cache: 'no-store' }));
  expect(fetchMock).toHaveBeenCalledWith('/ops/api/readiness', expect.objectContaining({ cache: 'no-store' }));
  expect(fetchMock).toHaveBeenCalledWith(`/ops/api/designer/${issueId}/policy`, expect.objectContaining({ cache: 'no-store' }));
});

test('approved artwork exposes only the safe unconfirmed manufacturing handoff from Designer', async () => {
  const fetchMock = mockDesignerFetch('APPROVED');

  render(<DesignerPanel />);
  await userEvent.click(await screen.findByRole('button', { name: /IO-TEST-001/i }));

  const send = await screen.findByRole('button', { name: /send to manufacturing/i });
  await userEvent.click(send);

  expect(fetchMock).toHaveBeenCalledWith('/ops/api/manufacturing/create-draft', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ issueId }),
  }));
  expect(screen.getByRole('status')).toHaveTextContent(/unconfirmed.*draft/i);
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/confirm'))).toBe(false);
});
