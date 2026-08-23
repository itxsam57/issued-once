import { beforeEach, expect, test, vi } from 'vitest';

const { createManufacturingEventServiceMock, enqueueIssueNotificationMock } = vi.hoisted(() => ({
  createManufacturingEventServiceMock: vi.fn(),
  enqueueIssueNotificationMock: vi.fn(),
}));
vi.mock('@/server/manufacturing/runtimeManufacturing', () => ({
  createManufacturingEventService: createManufacturingEventServiceMock,
  ManufacturingRuntimeUnavailableError: class ManufacturingRuntimeUnavailableError extends Error {},
}));
vi.mock('@/server/notifications/notificationQueue', () => ({
  enqueueIssueNotification: enqueueIssueNotificationMock,
}));

import { POST } from '@/app/api/webhooks/printful/route';

const issueId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  enqueueIssueNotificationMock.mockResolvedValue({ messageId: 'notify-1' });
});

test('passes raw Printful webhook evidence to verifier and queues shipped notification from the resolved Issue', async () => {
  const handle = vi.fn().mockResolvedValue({ kind: 'applied', issueId, eventType: 'SHIPMENT_SENT' });
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
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(issueId, 'SHIPPED');
});

test('duplicate shipment retries can resume a failed notification enqueue', async () => {
  createManufacturingEventServiceMock.mockReturnValue({
    handle: vi.fn().mockResolvedValue({ kind: 'duplicate', issueId, eventType: 'SHIPMENT_DELIVERED' }),
  });
  const response = await POST(new Request('https://issuedonce.shop/api/webhooks/printful', {
    method: 'POST', body: '{}', headers: { 'x-pf-webhook-signature': 'abc' },
  }));
  expect(response.status).toBe(200);
  expect(enqueueIssueNotificationMock).toHaveBeenCalledWith(issueId, 'DELIVERED');
});

test('invalid Printful signature is rejected without customer notification', async () => {
  createManufacturingEventServiceMock.mockReturnValue({
    handle: vi.fn(() => { throw new Error('Printful webhook signature is invalid'); }),
  });
  const response = await POST(new Request('https://issuedonce.shop/api/webhooks/printful', {
    method: 'POST', body: '{}',
  }));
  expect(response.status).toBe(401);
  expect(enqueueIssueNotificationMock).not.toHaveBeenCalled();
});
