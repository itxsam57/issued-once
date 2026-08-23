import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { PaidOrderWebhookService } from '@/server/issues/PaidOrderWebhookService';
import type { PaidOrderRepository } from '@/server/issues/PaidOrderRepository';
import { parseFourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';

describe('paid-order privacy boundaries', () => {
  test('provider PII and provider product/price overrides never enter reservation input', async () => {
    const providerPayload = {
      id: 'weve_private',
      webhookId: 'wcon_1',
      shopId: 'shop_1',
      type: 'ORDER_PLACED',
      apiVersion: 'V1',
      createdAt: '2026-08-18T10:44:00.000+00:00',
      testMode: false,
      data: {
        id: 'order_private',
        email: 'buyer-secret@example.com',
        message: 'private gift note',
        shipping: {
          name: 'Private Buyer',
          address1: '99 Secret Street',
          city: 'Private City',
        },
        lineItems: [
          {
            product: { name: 'ATTACKER PRODUCT' },
            variant: { id: 'attacker_variant' },
            price: { value: 1, currency: 'USD' },
          },
        ],
        metadata: { io_quote_id: 'quote-opaque-1' },
      },
    };
    const envelope = parseFourthwallWebhookEnvelope(
      Buffer.from(JSON.stringify(providerPayload), 'utf8'),
    );
    const reservePaidOrder = vi.fn().mockResolvedValue({
      kind: 'reserved',
      issueCode: 'IO-7K4M-92QF',
    });
    const repository: PaidOrderRepository = {
      recordAuthenticatedEvent: vi.fn().mockResolvedValue({
        providerEventId: envelope.id,
        status: 'RECEIVED',
        attemptCount: 0,
      }),
      markIgnoredTest: vi.fn().mockResolvedValue(undefined),
      reservePaidOrder,
      markTerminalFailure: vi.fn().mockResolvedValue(undefined),
      markRetryableFailure: vi.fn().mockResolvedValue(undefined),
    };
    const service = new PaidOrderWebhookService({
      repository,
      quoteRepository: {
        findById: vi.fn().mockResolvedValue({
          id: 'quote-opaque-1',
          experienceId: 'exp_1',
          productSlug: 'server-hoodie',
          variantId: 'server-variant',
          amountMinor: 5400,
          currency: 'USD',
          expiresAt: new Date('2026-08-18T11:00:00.000Z'),
        }),
      },
      issueCodeGenerator: () => 'IO-7K4M-92QF',
      now: () => new Date('2026-08-18T10:45:00.000Z'),
    });

    await service.process(envelope);

    const serializedEnvelope = JSON.stringify(envelope);
    const serializedReservation = JSON.stringify(reservePaidOrder.mock.calls[0]);
    for (const secret of [
      'buyer-secret@example.com',
      'private gift note',
      'Private Buyer',
      '99 Secret Street',
      'Private City',
      'ATTACKER PRODUCT',
      'attacker_variant',
    ]) {
      expect(serializedEnvelope).not.toContain(secret);
      expect(serializedReservation).not.toContain(secret);
    }
    expect(serializedReservation).not.toMatch(/amountMinor|productSlug|variantId|email|address/i);
    expect(reservePaidOrder).toHaveBeenCalledWith({
      providerEventId: 'weve_private',
      fourthwallOrderId: 'order_private',
      quoteId: 'quote-opaque-1',
      candidateIssueCode: 'IO-7K4M-92QF',
      now: new Date('2026-08-18T10:45:00.000Z'),
    });
  });

  test('webhook and Issue registry migration has no customer or quiz data columns', () => {
    const migration = readFileSync(
      path.join(process.cwd(), 'db/migrations/0005_webhook_issue_registry.sql'),
      'utf8',
    );

    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS webhook_events/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS issues/i);
    expect(migration).toMatch(/PRIMARY KEY \(provider, provider_event_id\)/i);
    expect(migration).toMatch(/issue_code TEXT NOT NULL UNIQUE/i);
    expect(migration).toMatch(/fourthwall_order_id TEXT NOT NULL UNIQUE/i);
    expect(migration).toMatch(/fourthwall_event_id TEXT NOT NULL UNIQUE/i);
    expect(migration).toMatch(/quote_id TEXT NOT NULL UNIQUE/i);
    expect(migration).not.toMatch(/customer_email|customer_name|shipping_address|quiz_answer|raw_body|payment_card/i);
  });
});
