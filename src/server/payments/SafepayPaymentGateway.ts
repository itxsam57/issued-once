import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentGateway, PaymentProviderState, VerifiedPaymentEvent } from './PaymentGateway';

type SafepayEnvironment = 'sandbox' | 'production';

type Options = {
  environment: SafepayEnvironment;
  apiKey: string;
  webhookSecret: string;
  fetchImpl?: typeof fetch;
};

type TrackerResponse = {
  data?: { token?: string };
};

type WebhookData = {
  client_id?: string;
  created_at?: string;
  updated_at?: string;
  token?: string;
  type?: string;
  notification?: {
    amount?: string | number;
    currency?: string;
    state?: string;
    tracker?: string;
    reference?: string;
  };
};

function apiBase(environment: SafepayEnvironment) {
  return environment === 'production'
    ? 'https://api.getsafepay.com'
    : 'https://sandbox.api.getsafepay.com';
}

function checkoutBase(environment: SafepayEnvironment) {
  return environment === 'production'
    ? 'https://getsafepay.com/checkout/pay'
    : 'https://sandbox.api.getsafepay.com/checkout/pay';
}

function assertCurrency(value: string) {
  if (value !== 'USD' && value !== 'PKR') {
    throw new Error('Safepay currency is unsupported');
  }
}

function minorToMajor(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Payment amount is invalid');
  return Number((value / 100).toFixed(2));
}

function decimalToMinor(value: string | number): number {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Safepay amount is invalid');
  const [whole, fraction = ''] = text.split('.');
  const minor = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Safepay amount is too large');
  return Number(minor);
}

function state(value: string): PaymentProviderState {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'PAID' || normalized === 'COMPLETED' || normalized === 'CAPTURED') return 'PAID';
  if (normalized === 'FAILED' || normalized === 'CANCELED' || normalized === 'CANCELLED' || normalized === 'REJECTED') return 'FAILED';
  if (normalized === 'REFUNDED') return 'REFUNDED';
  return 'PENDING';
}

function safeEqualHex(expected: string, provided: string): boolean {
  if (!/^[0-9a-f]+$/i.test(provided) || provided.length !== expected.length) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(provided, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export class SafepayPaymentGateway implements PaymentGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.apiKey.trim()) throw new Error('Safepay API key is required');
    if (!options.webhookSecret.trim()) throw new Error('Safepay webhook secret is required');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createCheckout(input: {
    paymentAttemptId: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    const amount = minorToMajor(input.amountMinor);
    const currency = input.currency.trim().toUpperCase();
    assertCurrency(currency);

    const response = await this.fetchImpl(`${apiBase(this.options.environment)}/order/v1/init`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        amount,
        client: this.options.apiKey,
        currency,
        environment: this.options.environment,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Safepay tracker creation failed');
    const payload = (await response.json()) as TrackerResponse;
    const token = payload.data?.token?.trim();
    if (!token || !token.startsWith('track_')) throw new Error('Safepay tracker response is invalid');

    const checkout = new URL(checkoutBase(this.options.environment));
    checkout.searchParams.set('beacon', token);
    checkout.searchParams.set('cancel_url', input.cancelUrl);
    checkout.searchParams.set('env', this.options.environment);
    checkout.searchParams.set('order_id', input.paymentAttemptId);
    checkout.searchParams.set('redirect_url', input.returnUrl);
    checkout.searchParams.set('source', 'custom');
    checkout.searchParams.set('webhooks', 'true');

    return { providerReference: token, checkoutUrl: checkout.toString() };
  }

  verifyWebhook(input: { rawBody: string; headers: Headers }): VerifiedPaymentEvent {
    let body: { data?: WebhookData };
    try {
      body = JSON.parse(input.rawBody) as { data?: WebhookData };
    } catch {
      throw new Error('Safepay webhook body is invalid');
    }
    const data = body.data;
    if (!data || typeof data !== 'object') throw new Error('Safepay webhook data is missing');

    const provided = input.headers.get('x-sfpy-signature')?.trim() ?? '';
    const expected = createHmac('sha512', this.options.webhookSecret)
      .update(Buffer.from(JSON.stringify(data)))
      .digest('hex');
    if (!safeEqualHex(expected, provided)) throw new Error('Safepay webhook signature is invalid');

    if (!data.client_id || data.client_id !== this.options.apiKey) {
      throw new Error('Safepay webhook merchant does not match');
    }
    if (!data.type?.trim().toLowerCase().startsWith('payment:')) {
      throw new Error('Safepay webhook event type is unsupported');
    }

    const notification = data.notification;
    const providerEventId = data.token?.trim();
    const providerReference = notification?.tracker?.trim();
    const currency = notification?.currency?.trim().toUpperCase();
    const providerState = notification?.state?.trim();
    const timestamp = data.updated_at ?? data.created_at;
    if (!providerEventId || !providerReference || !currency || !providerState || !timestamp) {
      throw new Error('Safepay webhook payload is incomplete');
    }
    assertCurrency(currency);
    if (notification?.amount === undefined) throw new Error('Safepay webhook amount is missing');
    const occurredAt = new Date(timestamp);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('Safepay webhook timestamp is invalid');

    return {
      providerEventId,
      providerReference,
      state: state(providerState),
      amountMinor: decimalToMinor(notification.amount),
      currency,
      reference: notification.reference?.trim() || null,
      occurredAt,
    };
  }
}
