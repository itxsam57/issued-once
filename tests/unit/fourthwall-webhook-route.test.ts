import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { createPaidOrderRuntimeMock, RuntimeUnavailableError, RetryableError } = vi.hoisted(() => ({
  createPaidOrderRuntimeMock: vi.fn(),
  RuntimeUnavailableError: class RuntimeUnavailableError extends Error {},
  RetryableError: class RetryableError extends Error {},
}));

vi.mock('@/server/issues/runtimePaidOrders', () => ({
  createPaidOrderRuntime: createPaidOrderRuntimeMock,
  PaidOrderRuntimeUnavailableError: RuntimeUnavailableError,
}));

vi.mock('@/server/issues/PaidOrderWebhookService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/issues/PaidOrderWebhookService')>();
  return {
    ...actual,
    RetryablePaidOrderError: RetryableError,
  };
});

import { POST } from '@/app/api/webhooks/fourthwall/route';

const secret = 'whsec_test';
const baseEvent = {
  id: 'weve_1',
  webhookId: 'wcon_1',
  shopId: 'shop_1',
  type: 'ORDER_PLACED',
  apiVersion: 'V1',
  createdAt: '2026-08-18T10:44:00.000+00:00',
  testMode: false,
  data: {
    id: 'order_1',
    metadata: { io_quote_id: 'quote-opaque-1' },
    email: 'must-not-be-logged@example.com',
  },
};

function signedRequest(body: string, signature?: string) {
  const hmac = signature ?? createHmac('sha256', secret).update(Buffer.from(body)).digest('base64');
  return new Request('http://localhost/api/webhooks/fourthwall', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fourthwall-hmac-sha256': hmac,
    },
    body,
  });
}

describe('POST /api/webhooks/fourthwall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rejects invalid signatures before processing or durable writes', async () => {
    const process = vi.fn();
    createPaidOrderRuntimeMock.mockReturnValue({
      service: { process },
      webhookSecret: secret,
      shopId: 'shop_1',
      apiVersion: 'V1',
    });
    const body = JSON.stringify(baseEvent);

    const response = await POST(signedRequest(body, 'invalid'));

    expect(response.status).toBe(401);
    expect(process).not.toHaveBeenCalled();
  });

  test('rejects malformed JSON only after a valid raw-body signature', async () => {
    const process = vi.fn();
    createPaidOrderRuntimeMock.mockReturnValue({
      service: { process },
      webhookSecret: secret,
      shopId: 'shop_1',
      apiVersion: 'V1',
    });
    const body = '{not-json';

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(400);
    expect(process).not.toHaveBeenCalled();
  });

  test('acknowledges authenticated wrong-shop, wrong-type, and wrong-version events without processing', async () => {
    const process = vi.fn();
    createPaidOrderRuntimeMock.mockReturnValue({
      service: { process },
      webhookSecret: secret,
      shopId: 'shop_1',
      apiVersion: 'V1',
    });

    for (const event of [
      { ...baseEvent, shopId: 'other_shop' },
      { ...baseEvent, type: 'ORDER_UPDATED' },
      { ...baseEvent, apiVersion: 'V2' },
    ]) {
      const response = await POST(signedRequest(JSON.stringify(event)));
      expect(response.status).toBe(200);
    }
    expect(process).not.toHaveBeenCalled();
  });

  test('acknowledges test, processed, duplicate, and terminal outcomes', async () => {
    const process = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'ignored-test' })
      .mockResolvedValueOnce({ kind: 'processed', issueCode: 'IO-AAAA-BBBB' })
      .mockResolvedValueOnce({ kind: 'duplicate', issueCode: 'IO-AAAA-BBBB' })
      .mockResolvedValueOnce({ kind: 'terminal', code: 'UNKNOWN_QUOTE' });
    createPaidOrderRuntimeMock.mockReturnValue({
      service: { process },
      webhookSecret: secret,
      shopId: 'shop_1',
      apiVersion: 'V1',
    });

    for (const event of [
      { ...baseEvent, testMode: true },
      baseEvent,
      baseEvent,
      baseEvent,
    ]) {
      const response = await POST(signedRequest(JSON.stringify(event)));
      expect(response.status).toBe(200);
    }
    expect(process).toHaveBeenCalledTimes(4);
  });

  test('returns 503 for runtime unavailability and retryable processing failure', async () => {
    createPaidOrderRuntimeMock.mockImplementationOnce(() => {
      throw new RuntimeUnavailableError();
    });
    const unavailable = await POST(signedRequest(JSON.stringify(baseEvent)));
    expect(unavailable.status).toBe(503);

    const process = vi.fn().mockRejectedValue(new RetryableError());
    createPaidOrderRuntimeMock.mockReturnValue({
      service: { process },
      webhookSecret: secret,
      shopId: 'shop_1',
      apiVersion: 'V1',
    });
    const retryable = await POST(signedRequest(JSON.stringify(baseEvent)));
    expect(retryable.status).toBe(503);
  });
});
