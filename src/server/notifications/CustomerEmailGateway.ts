export interface CustomerEmailGateway {
  send(input: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
}
