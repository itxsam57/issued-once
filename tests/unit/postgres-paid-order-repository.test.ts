import { describe, expect, test, vi } from 'vitest';
import { PostgresPaidOrderRepository } from '@/server/issues/PostgresPaidOrderRepository';

describe('PostgresPaidOrderRepository', () => {
  test('records only a minimized authenticated event and is idempotent by provider event id', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        provider_event_id: 'weve_1',
        processing_status: 'RECEIVED',
        attempt_count: 0,
      },
    ]);
    const repository = new PostgresPaidOrderRepository({ query });

    const event = await repository.recordAuthenticatedEvent({
      providerEventId: 'weve_1',
      webhookId: 'wcon_1',
      shopId: 'shop_1',
      eventType: 'ORDER_PLACED',
      apiVersion: 'V1',
      testMode: false,
      providerCreatedAt: new Date('2026-08-18T10:30:00.000Z'),
      receivedAt: new Date('2026-08-18T10:30:01.000Z'),
    });

    expect(event).toEqual({
      providerEventId: 'weve_1',
      status: 'RECEIVED',
      attemptCount: 0,
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO webhook_events/i);
    expect(sql).toMatch(/ON CONFLICT\s*\(provider,\s*provider_event_id\)/i);
    expect(sql).not.toMatch(/raw_body|email|shipping|address|message|quiz|answer/i);
    expect(JSON.stringify(params)).not.toMatch(/email|shipping|address|message|quiz|answer/i);
  });

  test('reserves from server quote and locked physical truth in one SQL statement', async () => {
    const query = vi.fn().mockResolvedValue([
      { kind: 'reserved', issue_code: 'IO-7K4M-92QF' },
    ]);
    const repository = new PostgresPaidOrderRepository({ query });

    const result = await repository.reservePaidOrder({
      providerEventId: 'weve_1',
      fourthwallOrderId: 'order_1',
      quoteId: 'quote-opaque-1',
      candidateIssueCode: 'IO-7K4M-92QF',
      now: new Date('2026-08-18T10:31:00.000Z'),
    });

    expect(result).toEqual({ kind: 'reserved', issueCode: 'IO-7K4M-92QF' });
    expect(query).toHaveBeenCalledTimes(1);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/checkout_quotes/i);
    expect(sql).toMatch(/experience_physical_selection/i);
    expect(sql).toMatch(/INSERT INTO issues/i);
    expect(sql).toMatch(/UPDATE webhook_events/i);
    expect(sql).toMatch(/processing_status\s*=\s*'PROCESSED'/i);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/i);
    expect(JSON.stringify(params)).toContain('quote-opaque-1');
    expect(JSON.stringify(params)).not.toMatch(/productSlug|variantId|sizeCode|colorCode|amountMinor|email|address/i);
  });

  test('distinguishes duplicate, quote mismatch, and issue-code collision without inventing an Issue', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ kind: 'duplicate', issue_code: 'IO-AAAA-BBBB' }])
      .mockResolvedValueOnce([{ kind: 'quote-mismatch', issue_code: null }])
      .mockResolvedValueOnce([{ kind: 'collision', issue_code: null }]);
    const repository = new PostgresPaidOrderRepository({ query });
    const input = {
      providerEventId: 'weve_1',
      fourthwallOrderId: 'order_1',
      quoteId: 'quote-opaque-1',
      candidateIssueCode: 'IO-7K4M-92QF',
      now: new Date('2026-08-18T10:31:00.000Z'),
    } as const;

    await expect(repository.reservePaidOrder(input)).resolves.toEqual({
      kind: 'duplicate',
      issueCode: 'IO-AAAA-BBBB',
    });
    await expect(repository.reservePaidOrder(input)).resolves.toEqual({ kind: 'quote-mismatch' });
    await expect(repository.reservePaidOrder(input)).resolves.toEqual({ kind: 'collision' });
  });
});
