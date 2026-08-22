import type { OpsSupportReplyGateway } from './OpsSupportService';

type Options = { apiKey: string; from: string; fetchImpl?: typeof fetch };

export class ResendOpsSupportReplyGateway implements OpsSupportReplyGateway {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: Options) {
    if (!options.apiKey.trim() || !options.from.trim()) throw new Error('Owner support reply is not configured');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(input: { to: string; issueCode: string; message: string; idempotencyKey: string }) {
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
        subject: `ISSUE / ${input.issueCode}`,
        text: `ISSUED ONCE\nISSUE / ${input.issueCode}\n\n${input.message}`,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Owner support reply delivery failed');
    const payload = await response.json() as { id?: string };
    if (!payload.id) throw new Error('Owner support reply response is invalid');
    return { providerMessageId: payload.id };
  }
}
