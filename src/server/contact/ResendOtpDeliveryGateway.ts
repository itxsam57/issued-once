import type { OtpDeliveryGateway } from './OtpDeliveryGateway';

type Options = {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
};

type ResendResponse = { id?: string };

function requestTag(challengeId: string): string {
  return challengeId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export class ResendOtpDeliveryGateway implements OtpDeliveryGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.apiKey.trim()) throw new Error('Resend API key is required');
    if (!options.from.trim()) throw new Error('Resend sender is required');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendOtp(input: { email: string; code: string; challengeId: string }) {
    const tag = requestTag(input.challengeId);
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `issued-once/otp/${input.challengeId}`,
        'User-Agent': 'issued-once/1.0',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [input.email],
        subject: `Your ISSUED ONCE code · ${tag}`,
        text: `ISSUED ONCE\n\n${input.code}\n\nRequest ${tag}\n\nThis code is yours for 10 minutes. If you did not ask for it, ignore this email.`,
      }),
      cache: 'no-store',
    });

    if (!response.ok) throw new Error('OTP delivery failed');
    const payload = (await response.json()) as ResendResponse;
    if (!payload.id) throw new Error('OTP delivery response is invalid');
    return { providerMessageId: payload.id };
  }
}
