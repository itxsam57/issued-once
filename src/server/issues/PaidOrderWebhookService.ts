import type { CheckoutQuoteRepository } from '@/server/checkout/CheckoutService';
import type { FourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';
import { generateIssueCode } from './IssueCode';
import type { PaidOrderRepository } from './PaidOrderRepository';

export type PaidOrderWebhookOutcome =
  | { kind: 'processed'; issueCode: string }
  | { kind: 'duplicate'; issueCode: string }
  | { kind: 'ignored-test' }
  | { kind: 'terminal'; code: string };

export class RetryablePaidOrderError extends Error {
  constructor(
    public readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'RetryablePaidOrderError';
  }
}

type Dependencies = {
  repository: PaidOrderRepository;
  quoteRepository: CheckoutQuoteRepository;
  issueCodeGenerator?: () => string;
  now?: () => Date;
};

const ISSUE_CODE_ATTEMPTS = 5;

export class PaidOrderWebhookService {
  private readonly issueCodeGenerator: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: Dependencies) {
    this.issueCodeGenerator = dependencies.issueCodeGenerator ?? (() => generateIssueCode());
    this.now = dependencies.now ?? (() => new Date());
  }

  async process(event: FourthwallWebhookEnvelope): Promise<PaidOrderWebhookOutcome> {
    const now = this.now();

    await this.dependencies.repository.recordAuthenticatedEvent({
      providerEventId: event.id,
      webhookId: event.webhookId,
      shopId: event.shopId,
      eventType: event.type,
      apiVersion: event.apiVersion,
      testMode: event.testMode,
      providerCreatedAt: new Date(event.createdAt),
      receivedAt: now,
    });

    if (event.testMode) {
      await this.dependencies.repository.markIgnoredTest(event.id, now);
      return { kind: 'ignored-test' };
    }

    const quoteId = event.metadata.io_quote_id?.trim();
    if (!quoteId) {
      await this.dependencies.repository.markTerminalFailure(
        event.id,
        'MISSING_QUOTE_ID',
        now,
      );
      return { kind: 'terminal', code: 'MISSING_QUOTE_ID' };
    }

    const quote = await this.dependencies.quoteRepository.findById(quoteId);
    if (!quote) {
      await this.dependencies.repository.markTerminalFailure(event.id, 'UNKNOWN_QUOTE', now);
      return { kind: 'terminal', code: 'UNKNOWN_QUOTE' };
    }

    for (let attempt = 0; attempt < ISSUE_CODE_ATTEMPTS; attempt += 1) {
      const candidateIssueCode = this.issueCodeGenerator();
      let result;

      try {
        result = await this.dependencies.repository.reservePaidOrder({
          providerEventId: event.id,
          fourthwallOrderId: event.orderId,
          quoteId: quote.id,
          candidateIssueCode,
          now,
        });
      } catch (error) {
        await this.dependencies.repository.markRetryableFailure(
          event.id,
          'RESERVATION_ERROR',
          now,
        );
        throw new RetryablePaidOrderError('RESERVATION_ERROR', { cause: error });
      }

      if (result.kind === 'reserved') {
        return { kind: 'processed', issueCode: result.issueCode };
      }

      if (result.kind === 'duplicate') {
        return { kind: 'duplicate', issueCode: result.issueCode };
      }

      if (result.kind === 'quote-mismatch') {
        await this.dependencies.repository.markTerminalFailure(
          event.id,
          'QUOTE_MISMATCH',
          now,
        );
        return { kind: 'terminal', code: 'QUOTE_MISMATCH' };
      }
    }

    await this.dependencies.repository.markRetryableFailure(
      event.id,
      'ISSUE_ID_COLLISION_BUDGET',
      now,
    );
    throw new RetryablePaidOrderError('ISSUE_ID_COLLISION_BUDGET');
  }
}
