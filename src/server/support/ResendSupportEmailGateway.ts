import type { SupportEmailGateway } from './SupportEmailGateway';

type Options = { apiKey: string; from: string; supportInbox: string; fetchImpl?: typeof fetch };
type ResendResponse = { id?: string };

export class ResendSupportEmailGateway implements SupportEmailGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.apiKey.trim() || !options.from.trim() || !options.supportInbox.trim()) {
      throw new Error('Support email is not configured');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(input: { issueCode: string; replyTo: string; message: string; idempotencyKey: string }) {
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
        to: [this.options.supportInbox],
        reply_to: input.replyTo,
        subject: `SUPPORT / ${input.issueCode}`,
        text: `ISSUED ONCE SUPPORT\nISSUE / ${input.issueCode}\n\n${input.message}`,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Support email delivery failed');
    const payload = (await response.json()) as ResendResponse;
    if (!payload.id) throw new Error('Support email delivery response is invalid');
    return { providerMessageId: payload.id };
  }
}
