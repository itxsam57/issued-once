import { expect, test, vi } from 'vitest';

const { createManufacturingEventServiceMock } = vi.hoisted(() => ({ createManufacturingEventServiceMock: vi.fn() }));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  createManufacturingEventService: createManufacturingEventServiceMock,
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
}));

import { POST } from '@/app/api/webhooks/printful/route';

test('passes raw Printful webhook evidence to verifier before acknowledging it', async () => {
  const handle = vi.fn().mockResolvedValue({ kind: 'applied' });
  createManufacturingEventServiceMock.mockReturnValue({ handle });
  const rawBody = '{"type":"shipment_sent"}';
  const request = new Request('https://issuedonce.shop/api/webhooks/printful', {
    method: 'POST',
    headers: { 'x-pf-webhook-signature': 'abc', 'x-pf-webhook-public-key': 'key' },
    body: rawBody,
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(handle).toHaveBeenCalledWith({ rawBody, headers: request.headers });
});

test('invalid Printful signature is rejected', async () => {
  createManufacturingEventServiceMock.mockReturnValue({
    handle: vi.fn(() => { throw new Error('Printful webhook signature is invalid'); }),
  });
  const response = await POST(new Request('https://issuedonce.shop/api/webhooks/printful', {
    method: 'POST', body: '{}',
  }));
  expect(response.status).toBe(401);
});
