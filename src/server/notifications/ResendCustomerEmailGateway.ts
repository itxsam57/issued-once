import type { CustomerEmailGateway } from './CustomerEmailGateway';

type Options = { apiKey: string; from: string; replyTo?: string; fetchImpl?: typeof fetch };
type ResendResponse = { id?: string };

export class ResendCustomerEmailGateway implements CustomerEmailGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.apiKey.trim() || !options.from.trim()) throw new Error('Resend customer email is not configured');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(input: { to: string; subject: string; text: string; idempotencyKey: string }) {
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
        'User-Agent': 'issued-once/1.0',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(this.options.replyTo?.trim() ? { reply_to: this.options.replyTo.trim() } : {}),
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Customer email delivery failed');
    const payload = (await response.json()) as ResendResponse;
    if (!payload.id) throw new Error('Customer email delivery response is invalid');
    return { providerMessageId: payload.id };
  }
}
