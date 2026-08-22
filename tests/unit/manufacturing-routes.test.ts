import { afterEach, expect, test, vi } from 'vitest';

const { createManufacturingServiceMock } = vi.hoisted(() => ({ createManufacturingServiceMock: vi.fn() }));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  createManufacturingService: createManufacturingServiceMock,
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
}));

import { POST as createDraft } from '@/app/api/internal/manufacturing/create-draft/route';
import { POST as confirmDraft } from '@/app/api/internal/manufacturing/confirm/route';

const issueId = 'a45f40f8-3819-4ea3-b696-595e91f63e3a';
const auth = { authorization: 'Bearer owner-secret-token-that-is-long', 'content-type': 'application/json' };

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
  delete process.env.PRINTFUL_ALLOW_CONFIRM;
  vi.clearAllMocks();
});

test('owner can create a Printful draft but this operation cannot confirm or charge it', async () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
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
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
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
