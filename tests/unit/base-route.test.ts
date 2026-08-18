import { beforeEach, describe, expect, test, vi } from 'vitest';

const { cookiesMock, createBaseSelectionServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createBaseSelectionServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/server/physical/runtimePhysical', () => ({
  createBaseSelectionService: createBaseSelectionServiceMock,
  PhysicalRuntimeUnavailableError: class PhysicalRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/experience/base/route';

describe('POST /api/experience/base', () => {
  beforeEach(() => vi.clearAllMocks());

  test('refuses base confirmation when the anonymous experience cookie is missing', async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });

    const response = await POST(new Request('http://localhost/api/experience/base', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ colorCode: 'Bone' }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Experience session is required' });
    expect(createBaseSelectionServiceMock).not.toHaveBeenCalled();
  });

  test('passes only cookie session and colorCode to the service and returns only opaque quote facts', async () => {
    const confirm = vi.fn().mockResolvedValue({
      quoteId: 'quote-opaque-001',
      amountMinor: 5400,
      currency: 'USD',
      expiresAt: '2026-08-18T06:30:00.000Z',
    });
    createBaseSelectionServiceMock.mockReturnValue({ confirm });
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'browser-session-token' }),
    });

    const response = await POST(new Request('http://localhost/api/experience/base', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        colorCode: 'Bone',
        object: 'hoodie',
        sizeCode: 'M',
        productSlug: 'attacker-product',
        variantId: 'attacker-variant',
        amountMinor: 1,
      }),
    }));

    expect(response.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith({
      sessionToken: 'browser-session-token',
      colorCode: 'Bone',
    });
    expect(await response.json()).toEqual({
      quoteId: 'quote-opaque-001',
      amountMinor: 5400,
      currency: 'USD',
      expiresAt: '2026-08-18T06:30:00.000Z',
    });
  });
});
