export type WebhookProcessingStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL'
  | 'IGNORED_TEST';

export type AuthenticatedOrderEvent = {
  providerEventId: string;
  webhookId: string;
  shopId: string;
  eventType: string;
  apiVersion: string;
  testMode: boolean;
  providerCreatedAt: Date;
  receivedAt: Date;
};

export type WebhookInboxRecord = {
  providerEventId: string;
  status: WebhookProcessingStatus;
  attemptCount: number;
};

export type PaidOrderReservationInput = {
  providerEventId: string;
  fourthwallOrderId: string;
  quoteId: string;
  candidateIssueCode: string;
  now: Date;
};

export type PaidOrderReservationResult =
  | { kind: 'reserved'; issueCode: string }
  | { kind: 'duplicate'; issueCode: string }
  | { kind: 'quote-mismatch' }
  | { kind: 'collision' };

export interface PaidOrderRepository {
  recordAuthenticatedEvent(event: AuthenticatedOrderEvent): Promise<WebhookInboxRecord>;
  markIgnoredTest(providerEventId: string, now: Date): Promise<void>;
  reservePaidOrder(input: PaidOrderReservationInput): Promise<PaidOrderReservationResult>;
  markTerminalFailure(providerEventId: string, failureCode: string, now: Date): Promise<void>;
  markRetryableFailure(providerEventId: string, failureCode: string, now: Date): Promise<void>;
}
