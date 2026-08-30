import { afterEach, expect, test, vi } from 'vitest';

const { createManufacturingServiceMock } = vi.hoisted(() => ({ createManufacturingServiceMock: vi.fn() }));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  createManufacturingService: createManufacturingServiceMock,
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
}));

import { POST as createDraft } from '@/app/api/internal/manufacturing/create-draft/route';
import { POST as confirmDraft } from '@/app/api/internal/manufacturing/confirm/route';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';
const ownerToken = 'owner-secret-token-that-is-long';
const auth = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };

function loggedText(consoleError: ReturnType<typeof vi.spyOn>) {
  return consoleError.mock.calls.flat()
    .map((value: unknown) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value)))
    .join(' ');
}

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
  delete process.env.PRINTFUL_ALLOW_CONFIRM;
  vi.clearAllMocks();
});

test('owner can create a Printful draft but this operation cannot confirm or charge it', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const create = vi.fn().mockResolvedValue({ id: 'mfg-1', state: 'DRAFT', providerOrderId: '987654' });
  createManufacturingServiceMock.mockReturnValue({ createDraft: create, confirmDraft: vi.fn() });

  const response = await createDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/create-draft', {
    method: 'POST', headers: auth, body: JSON.stringify({ issueId }),
  }));
  expect(response.status).toBe(200);
  expect(create).toHaveBeenCalledWith(issueId);
  expect(await response.json()).toEqual({ manufacturingJobId: 'mfg-1', state: 'DRAFT', providerOrderId: '987654' });
});

test('Printful confirmation is blocked unless the production charge flag and exact Issue confirmation phrase are both present', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const confirm = vi.fn().mockResolvedValue({ id: 'mfg-1', state: 'IN_PRODUCTION' });
  createManufacturingServiceMock.mockReturnValue({ confirmDraft: confirm });

  const disabled = await confirmDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/confirm', {
    method: 'POST', headers: auth, body: JSON.stringify({ issueId, confirmation: `CONFIRM ${issueId}` }),
  }));
  expect(disabled.status).toBe(503);
  expect(confirm).not.toHaveBeenCalled();

  process.env.PRINTFUL_ALLOW_CONFIRM = 'true';
  const wrongPhrase = await confirmDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/confirm', {
    method: 'POST', headers: auth, body: JSON.stringify({ issueId, confirmation: 'yes' }),
  }));
  expect(wrongPhrase.status).toBe(400);
  expect(confirm).not.toHaveBeenCalled();

  const approved = await confirmDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/confirm', {
    method: 'POST', headers: auth, body: JSON.stringify({ issueId, confirmation: `CONFIRM ${issueId}` }),
  }));
  expect(approved.status).toBe(200);
  expect(confirm).toHaveBeenCalledWith(issueId);
});

test('does not leak unexpected manufacturing draft error details into server logs', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  const sensitiveMarker = 'manufacturing-create-secret-sentinel';
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const create = vi.fn().mockRejectedValueOnce(new Error(`unexpected upstream failure ${sensitiveMarker}`));
  createManufacturingServiceMock.mockReturnValue({ createDraft: create });

  try {
    const response = await createDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/create-draft', {
      method: 'POST', headers: auth, body: JSON.stringify({ issueId }),
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Manufacturing draft failed' });
    expect(loggedText(consoleError)).not.toContain(sensitiveMarker);
  } finally {
    consoleError.mockRestore();
  }
});

test('does not leak unexpected manufacturing confirmation error details into server logs', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = ownerToken;
  process.env.PRINTFUL_ALLOW_CONFIRM = 'true';
  const sensitiveMarker = 'manufacturing-charge-secret-sentinel';
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const confirm = vi.fn().mockRejectedValueOnce(new Error(`unexpected upstream failure ${sensitiveMarker}`));
  createManufacturingServiceMock.mockReturnValue({ confirmDraft: confirm });

  try {
    const response = await confirmDraft(new Request('https://issuedonce.shop/api/internal/manufacturing/confirm', {
      method: 'POST', headers: auth, body: JSON.stringify({ issueId, confirmation: `CONFIRM ${issueId}` }),
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Manufacturing confirmation failed' });
    expect(loggedText(consoleError)).not.toContain(sensitiveMarker);
  } finally {
    consoleError.mockRestore();
  }
});
