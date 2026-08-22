import { beforeEach, describe, expect, test, vi } from 'vitest';

const { cookiesMock, createCheckoutStartServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createCheckoutStartServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/server/checkout/runtimeCheckout', () => ({
  createCheckoutStartService: createCheckoutStartServiceMock,
  CheckoutRuntimeUnavailableError: class CheckoutRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/checkout/start/route';

describe('POST /api/checkout/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('refuses checkout when the anonymous session cookie is missing', async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const response = await POST(
      new Request('http://localhost/api/checkout/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteId: 'q_opaque_1' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Checkout session is required' });
    expect(createCheckoutStartServiceMock).not.toHaveBeenCalled();
  });

  test('passes only the cookie session token and opaque quote id to the checkout service', async () => {
    const start = vi.fn().mockResolvedValue({
      checkoutUrl: 'https://mystore.fourthwall.com/cart/checkout?cartId=cart_123',
    });
    createCheckoutStartServiceMock.mockReturnValue({ start });
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'browser-session-token' }),
    });

    const response = await POST(
      new Request('http://localhost/api/checkout/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteId: 'q_opaque_1' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(start).toHaveBeenCalledWith({
      sessionToken: 'browser-session-token',
      quoteId: 'q_opaque_1',
    });
    expect(await response.json()).toEqual({
      checkoutUrl: 'https://mystore.fourthwall.com/cart/checkout?cartId=cart_123',
    });
  });
});
