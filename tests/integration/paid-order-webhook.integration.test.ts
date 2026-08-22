import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import type { CheckoutQuoteRecord } from '@/server/checkout/CheckoutService';
import { PaidOrderWebhookService } from '@/server/issues/PaidOrderWebhookService';
import type {
  AuthenticatedOrderEvent,
  PaidOrderRepository,
  PaidOrderReservationInput,
  PaidOrderReservationResult,
  WebhookInboxRecord,
} from '@/server/issues/PaidOrderRepository';
import { parseFourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';
import { verifyFourthwallWebhookSignature } from '@/server/webhooks/FourthwallWebhookSignature';

class MemoryPaidOrderRepository implements PaidOrderRepository {
  readonly events = new Map<string, WebhookInboxRecord>();
  readonly issues = new Map<string, {
    issueCode: string;
    providerEventId: string;
    fourthwallOrderId: string;
    quoteId: string;
  }>();
  readonly reservations: PaidOrderReservationInput[] = [];

  async recordAuthenticatedEvent(event: AuthenticatedOrderEvent): Promise<WebhookInboxRecord> {
    const existing = this.events.get(event.providerEventId);
    if (existing) return existing;
    const created: WebhookInboxRecord = {
      providerEventId: event.providerEventId,
      status: 'RECEIVED',
      attemptCount: 0,
    };
    this.events.set(event.providerEventId, created);
    return created;
  }

  async markIgnoredTest(providerEventId: string): Promise<void> {
    const event = this.events.get(providerEventId);
    if (event) this.events.set(providerEventId, { ...event, status: 'IGNORED_TEST' });
  }

  async reservePaidOrder(input: PaidOrderReservationInput): Promise<PaidOrderReservationResult> {
    this.reservations.push(input);
    const existing = [...this.issues.values()].find(
      (issue) =>
        issue.providerEventId === input.providerEventId ||
        issue.fourthwallOrderId === input.fourthwallOrderId ||
        issue.quoteId === input.quoteId,
    );
    if (existing) return { kind: 'duplicate', issueCode: existing.issueCode };
    if (this.issues.has(input.candidateIssueCode)) return { kind: 'collision' };

    this.issues.set(input.candidateIssueCode, {
      issueCode: input.candidateIssueCode,
      providerEventId: input.providerEventId,
      fourthwallOrderId: input.fourthwallOrderId,
      quoteId: input.quoteId,
    });
    const event = this.events.get(input.providerEventId);
    if (event) this.events.set(input.providerEventId, { ...event, status: 'PROCESSED' });
    return { kind: 'reserved', issueCode: input.candidateIssueCode };
  }

  async markTerminalFailure(providerEventId: string): Promise<void> {
    const event = this.events.get(providerEventId);
    if (event) this.events.set(providerEventId, { ...event, status: 'FAILED_TERMINAL' });
  }

  async markRetryableFailure(providerEventId: string): Promise<void> {
    const event = this.events.get(providerEventId);
    if (event) this.events.set(providerEventId, { ...event, status: 'FAILED_RETRYABLE' });
  }
}

const quote: CheckoutQuoteRecord = {
  id: 'quote-paid-1',
  experienceId: 'exp-paid-1',
  productSlug: 'server-hoodie',
  variantId: 'server-variant-1',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: new Date('2026-08-18T12:00:00.000Z'),
};

function signedFixture(overrides: Record<string, unknown> = {}) {
  const providerPayload = {
    id: 'weve_paid_1',
    webhookId: 'wcon_1',
    shopId: 'shop_1',
    type: 'ORDER_PLACED',
    apiVersion: 'V1',
    createdAt: '2026-08-18T10:44:00.000+00:00',
    testMode: false,
    data: {
      id: 'order_paid_1',
      email: 'customer-private@example.com',
      message: 'private message',
      shipping: { name: 'Private Customer', address1: '1 Hidden Road' },
      lineItems: [{ variant: { id: 'payload-override' }, price: { value: 1 } }],
      metadata: { io_quote_id: 'quote-paid-1' },
    },
    ...overrides,
  };
  const raw = Buffer.from(JSON.stringify(providerPayload), 'utf8');
  const secret = 'integration-secret';
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  return { raw, secret, signature };
}

function buildService(repository: MemoryPaidOrderRepository, codes: string[]) {
  let index = 0;
  return new PaidOrderWebhookService({
    repository,
    quoteRepository: {
      findById: async (id) => (id === quote.id ? quote : null),
    },
    issueCodeGenerator: () => codes[index++] ?? `IO-ZZZZ-${String(index).padStart(4, '2')}`,
    now: () => new Date('2026-08-18T10:45:00.000Z'),
  });
}

describe('signed paid-order integration', () => {
  test('valid signed paid event creates one private Issue and replay returns the same Issue', async () => {
    const repository = new MemoryPaidOrderRepository();
    const service = buildService(repository, ['IO-AAAA-BBBB', 'IO-CCCC-DDDD']);
    const fixture = signedFixture();

    expect(
      verifyFourthwallWebhookSignature(fixture.raw, fixture.signature, fixture.secret),
    ).toBe(true);
    const envelope = parseFourthwallWebhookEnvelope(fixture.raw);

    const first = await service.process(envelope);
    const replay = await service.process(envelope);

    expect(first).toEqual({ kind: 'processed', issueCode: 'IO-AAAA-BBBB' });
    expect(replay).toEqual({ kind: 'duplicate', issueCode: 'IO-AAAA-BBBB' });
    expect(repository.issues.size).toBe(1);
    expect(repository.events.size).toBe(1);
    expect(JSON.stringify(repository.reservations)).not.toMatch(
      /customer-private@example\.com|private message|Private Customer|Hidden Road|payload-override/i,
    );
  });

  test('concurrent duplicate delivery still produces one commercial Issue', async () => {
    const repository = new MemoryPaidOrderRepository();
    const service = buildService(repository, ['IO-AAAA-BBBB', 'IO-CCCC-DDDD']);
    const fixture = signedFixture();
    const envelope = parseFourthwallWebhookEnvelope(fixture.raw);

    const outcomes = await Promise.all([service.process(envelope), service.process(envelope)]);

    expect(repository.issues.size).toBe(1);
    expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual(['duplicate', 'processed']);
    expect(outcomes.every((outcome) => 'issueCode' in outcome && outcome.issueCode === 'IO-AAAA-BBBB')).toBe(true);
  });

  test('signed Fourthwall test notification never creates a production Issue', async () => {
    const repository = new MemoryPaidOrderRepository();
    const service = buildService(repository, ['IO-AAAA-BBBB']);
    const fixture = signedFixture({ testMode: true });
    const envelope = parseFourthwallWebhookEnvelope(fixture.raw);

    await expect(service.process(envelope)).resolves.toEqual({ kind: 'ignored-test' });
    expect(repository.issues.size).toBe(0);
    expect(repository.events.get('weve_paid_1')?.status).toBe('IGNORED_TEST');
  });
});
