export type PaymentProviderState = 'PAID' | 'FAILED' | 'REFUNDED' | 'PENDING';

export type VerifiedPaymentEvent = {
  providerEventId: string;
  providerReference: string;
  state: PaymentProviderState;
  amountMinor: number;
  currency: string;
  reference: string | null;
  occurredAt: Date;
};

export interface PaymentGateway {
  createCheckout(input: {
    paymentAttemptId: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ providerReference: string; checkoutUrl: string }>;

  verifyWebhook(input: {
    rawBody: string;
    headers: Headers;
  }): VerifiedPaymentEvent;
}
