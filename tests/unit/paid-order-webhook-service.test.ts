import { describe, expect, test, vi } from 'vitest';
import type { CheckoutQuoteRecord } from '@/server/checkout/CheckoutService';
import type { PaidOrderRepository } from '@/server/issues/PaidOrderRepository';
import {
  PaidOrderWebhookService,
  RetryablePaidOrderError,
} from '@/server/issues/PaidOrderWebhookService';
import type { FourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';

const now = new Date('2026-08-18T10:45:00.000Z');

const envelope: FourthwallWebhookEnvelope = {
  id: 'weve_1',
  webhookId: 'wcon_1',
  shopId: 'shop_1',
  type: 'ORDER_PLACED',
  apiVersion: 'V1',
  createdAt: '2026-08-18T10:44:00.000+00:00',
  testMode: false,
  orderId: 'order_1',
  metadata: { io_quote_id: 'quote-opaque-1' },
};

const quote: CheckoutQuoteRecord = {
  id: 'quote-opaque-1',
  experienceId: 'exp_1',
  productSlug: 'hoodie',
  variantId: 'variant_1',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: new Date('2026-08-18T11:00:00.000Z'),
};

function setup() {
  const repository: PaidOrderRepository = {
    recordAuthenticatedEvent: vi.fn().mockResolvedValue({
      providerEventId: 'weve_1',
      status: 'RECEIVED',
      attemptCount: 0,
    }),
    markIgnoredTest: vi.fn().mockResolvedValue(undefined),
    reservePaidOrder: vi.fn().mockResolvedValue({
      kind: 'reserved',
      issueCode: 'IO-7K4M-92QF',
    }),
    markTerminalFailure: vi.fn().mockResolvedValue(undefined),
    markRetryableFailure: vi.fn().mockResolvedValue(undefined),
  };
  const quoteRepository = {
    findById: vi.fn().mockResolvedValue(quote),
  };
  const issueCodes = vi.fn().mockReturnValue('IO-7K4M-92QF');
  const service = new PaidOrderWebhookService({
    repository,
    quoteRepository,
    issueCodeGenerator: issueCodes,
    now: () => now,
  });

  return { service, repository, quoteRepository, issueCodes };
}

describe('PaidOrderWebhookService', () => {
  test('authenticates the event into the inbox but isolates Fourthwall test notifications from production Issues', async () => {
    const { service, repository, quoteRepository } = setup();

    await expect(service.process({ ...envelope, testMode: true })).resolves.toEqual({
      kind: 'ignored-test',
    });

    expect(repository.recordAuthenticatedEvent).toHaveBeenCalledTimes(1);
    expect(repository.markIgnoredTest).toHaveBeenCalledWith('weve_1', now);
    expect(repository.reservePaidOrder).not.toHaveBeenCalled();
    expect(quoteRepository.findById).not.toHaveBeenCalled();
  });

  test('classifies missing quote correlation as terminal without creating an Issue', async () => {
    const { service, repository } = setup();

    await expect(service.process({ ...envelope, metadata: {} })).resolves.toEqual({
      kind: 'terminal',
      code: 'MISSING_QUOTE_ID',
    });

    expect(repository.markTerminalFailure).toHaveBeenCalledWith(
      'weve_1',
      'MISSING_QUOTE_ID',
      now,
    );
    expect(repository.reservePaidOrder).not.toHaveBeenCalled();
  });

  test('classifies an unknown quote as terminal without creating an Issue', async () => {
    const { service, repository, quoteRepository } = setup();
    vi.mocked(quoteRepository.findById).mockResolvedValue(null);

    await expect(service.process(envelope)).resolves.toEqual({
      kind: 'terminal',
      code: 'UNKNOWN_QUOTE',
    });

    expect(repository.markTerminalFailure).toHaveBeenCalledWith('weve_1', 'UNKNOWN_QUOTE', now);
    expect(repository.reservePaidOrder).not.toHaveBeenCalled();
  });

  test('reserves from event/order/quote identity only and returns the permanent Issue code', async () => {
    const { service, repository } = setup();

    await expect(service.process(envelope)).resolves.toEqual({
      kind: 'processed',
      issueCode: 'IO-7K4M-92QF',
    });

    expect(repository.reservePaidOrder).toHaveBeenCalledWith({
      providerEventId: 'weve_1',
      fourthwallOrderId: 'order_1',
      quoteId: 'quote-opaque-1',
      candidateIssueCode: 'IO-7K4M-92QF',
      now,
    });
    expect(JSON.stringify(vi.mocked(repository.reservePaidOrder).mock.calls[0])).not.toMatch(
      /email|address|price|product|variant|size|color/i,
    );
  });

  test('returns an existing Issue for duplicate delivery', async () => {
    const { service, repository, issueCodes } = setup();
    vi.mocked(repository.reservePaidOrder).mockResolvedValue({
      kind: 'duplicate',
      issueCode: 'IO-OLD2-CODE',
    });

    await expect(service.process(envelope)).resolves.toEqual({
      kind: 'duplicate',
      issueCode: 'IO-OLD2-CODE',
    });
    expect(issueCodes).toHaveBeenCalledTimes(1);
  });

  test('retries a random Issue-code collision with a fresh candidate', async () => {
    const { service, repository, issueCodes } = setup();
    issueCodes.mockReturnValueOnce('IO-AAAA-AAAA').mockReturnValueOnce('IO-BBBB-BBBB');
    vi.mocked(repository.reservePaidOrder)
      .mockResolvedValueOnce({ kind: 'collision' })
      .mockResolvedValueOnce({ kind: 'reserved', issueCode: 'IO-BBBB-BBBB' });

    await expect(service.process(envelope)).resolves.toEqual({
      kind: 'processed',
      issueCode: 'IO-BBBB-BBBB',
    });
    expect(issueCodes).toHaveBeenCalledTimes(2);
  });

  test('marks collision-budget exhaustion retryable and surfaces a retryable error', async () => {
    const { service, repository, issueCodes } = setup();
    vi.mocked(repository.reservePaidOrder).mockResolvedValue({ kind: 'collision' });

    await expect(service.process(envelope)).rejects.toBeInstanceOf(RetryablePaidOrderError);
    expect(issueCodes).toHaveBeenCalledTimes(5);
    expect(repository.markRetryableFailure).toHaveBeenCalledWith(
      'weve_1',
      'ISSUE_ID_COLLISION_BUDGET',
      now,
    );
  });

  test('classifies reconciled-quote mismatch as terminal', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.reservePaidOrder).mockResolvedValue({ kind: 'quote-mismatch' });

    await expect(service.process(envelope)).resolves.toEqual({
      kind: 'terminal',
      code: 'QUOTE_MISMATCH',
    });
    expect(repository.markTerminalFailure).toHaveBeenCalledWith('weve_1', 'QUOTE_MISMATCH', now);
  });
});
