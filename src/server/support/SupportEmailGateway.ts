export interface SupportEmailGateway {
  send(input: {
    issueCode: string;
    replyTo: string;
    message: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
}
