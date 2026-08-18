export type PaymentAttemptStatus =
  | 'CREATED'
  | 'REDIRECTED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'EXCEPTION';

export type PaymentAttemptRecord = {
  id: string;
  experienceId: string;
  quoteId: string;
  contactId: string;
  shippingSnapshotId: string;
  provider: 'SAFEPAY';
  providerReference: string | null;
  checkoutUrl: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentProviderEvent = {
  provider: 'SAFEPAY';
  providerEventId: string;
  providerReference: string;
  state: string;
  amountMinor: number;
  currency: string;
  reference: string | null;
  receivedAt: Date;
};

export interface PaymentRepository {
  findReusable(experienceId: string, quoteId: string): Promise<PaymentAttemptRecord | null>;
  create(record: PaymentAttemptRecord): Promise<PaymentAttemptRecord>;
  attachProvider(input: {
    attemptId: string;
    providerReference: string;
    checkoutUrl: string;
    updatedAt: Date;
  }): Promise<void>;
  findByProviderReference(providerReference: string): Promise<PaymentAttemptRecord | null>;
  recordProviderEvent(event: PaymentProviderEvent): Promise<boolean>;
  markPaid(input: {
    attemptId: string;
    providerEventId: string;
    amountMinor: number;
    currency: string;
    paidAt: Date;
  }): Promise<'paid' | 'duplicate' | 'mismatch'>;
  markFailed(attemptId: string, providerEventId: string, at: Date): Promise<void>;
}
