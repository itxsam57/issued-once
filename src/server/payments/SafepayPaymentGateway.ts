import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentGateway, PaymentProviderState, VerifiedPaymentEvent } from './PaymentGateway';

type SafepayEnvironment = 'sandbox' | 'production';

type Options = {
  environment: SafepayEnvironment;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  fetchImpl?: typeof fetch;
};

type Money = {
  amount?: number;
  currency?: string;
};

type SafepayTracker = {
  token?: string;
  client?: string | { api_key?: string; apiKey?: string };
  state?: string;
  purchase_totals?: {
    quote_amount?: Money;
    base_amount?: Money;
  };
};

type TrackerResponse = {
  data?: {
    token?: string;
    tracker?: SafepayTracker;
  };
  status?: { errors?: unknown[] };
};

type PassportResponse = {
  data?: string | { token?: string; tbt?: string };
  status?: { errors?: unknown[] };
};

type TrackerEnvelope = { tracker?: SafepayTracker };

type TrackerLookupResponse = {
  data?: SafepayTracker | TrackerEnvelope;
  status?: { errors?: unknown[] };
};

type ProtoTimestamp = string | {
  seconds?: number | string;
  nanos?: number;
};

type V2WebhookData = {
  tracker?: string;
  state?: string;
  amount?: number;
  refund_amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  charged_at?: ProtoTimestamp;
  refunded_at?: ProtoTimestamp;
  failed_at?: ProtoTimestamp;
};

type V2WebhookBody = {
  token?: string;
  version?: string;
  merchant_api_key?: string;
  type?: string;
  data?: V2WebhookData;
  created_at?: ProtoTimestamp;
};

type LegacyWebhookData = {
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
    ? 'https://getsafepay.com/embedded'
    : 'https://sandbox.api.getsafepay.com/embedded';
}

function assertCurrency(value: string) {
  if (value !== 'USD' && value !== 'PKR') {
    throw new Error('Safepay currency is unsupported');
  }
}

function assertMinorAmount(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Payment amount is invalid');
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
  if (normalized === 'PAID' || normalized === 'COMPLETED' || normalized === 'CAPTURED' || normalized === 'TRACKER_ENDED') return 'PAID';
  if (normalized === 'FAILED' || normalized === 'CANCELED' || normalized === 'CANCELLED' || normalized === 'REJECTED') return 'FAILED';
  if (normalized === 'REFUNDED') return 'REFUNDED';
  return 'PENDING';
}

function stateFromV2Type(value: string): PaymentProviderState {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'payment.succeeded') return 'PAID';
  if (normalized === 'payment.failed') return 'FAILED';
  if (normalized === 'payment.refunded') return 'REFUNDED';
  throw new Error('Safepay webhook event type is unsupported');
}

function safeEqualHex(expected: string, provided: string): boolean {
  if (!/^[0-9a-f]+$/i.test(provided) || provided.length !== expected.length) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(provided, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function merchantClient(client: SafepayTracker['client']): string | null {
  if (typeof client === 'string') return client.trim() || null;
  if (!client || typeof client !== 'object') return null;
  return client.api_key?.trim() || client.apiKey?.trim() || null;
}

function isTrackerEnvelope(value: SafepayTracker | TrackerEnvelope): value is TrackerEnvelope {
  return Object.prototype.hasOwnProperty.call(value, 'tracker');
}

function unwrapTracker(value: TrackerLookupResponse['data']): SafepayTracker | undefined {
  if (!value) return undefined;
  return isTrackerEnvelope(value) ? value.tracker : value;
}

function parseTimestamp(...candidates: Array<ProtoTimestamp | undefined>): Date {
  for (const value of candidates) {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      continue;
    }
    if (value && typeof value === 'object' && value.seconds !== undefined) {
      const seconds = Number(value.seconds);
      const nanos = Number(value.nanos ?? 0);
      if (Number.isFinite(seconds) && Number.isFinite(nanos)) {
        const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  throw new Error('Safepay webhook timestamp is invalid');
}

function metadataReference(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.order_id;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export class SafepayPaymentGateway implements PaymentGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Options) {
    if (!options.apiKey.trim()) throw new Error('Safepay API key is required');
    if (!options.apiSecret.trim()) throw new Error('Safepay API secret is required');
    if (!options.webhookSecret.trim()) throw new Error('Safepay webhook secret is required');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private secretHeaders(includeJson = false): HeadersInit {
    return {
      accept: 'application/json',
      ...(includeJson ? { 'content-type': 'application/json' } : {}),
      'x-sfpy-merchant-secret': this.options.apiSecret,
    };
  }

  async createCheckout(input: {
    paymentAttemptId: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    assertMinorAmount(input.amountMinor);
    const currency = input.currency.trim().toUpperCase();
    assertCurrency(currency);

    const response = await this.fetchImpl(`${apiBase(this.options.environment)}/order/payments/v3/`, {
      method: 'POST',
      headers: this.secretHeaders(true),
      body: JSON.stringify({
        merchant_api_key: this.options.apiKey,
        intent: 'CYBERSOURCE',
        mode: 'payment',
        entry_mode: 'raw',
        currency,
        amount: input.amountMinor,
        metadata: { order_id: input.paymentAttemptId },
        include_fees: false,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Safepay tracker creation failed');
    const payload = (await response.json()) as TrackerResponse;
    if (payload.status?.errors?.length) throw new Error('Safepay tracker creation failed');
    const token = (payload.data?.tracker?.token ?? payload.data?.token)?.trim();
    if (!token || !token.startsWith('track_')) throw new Error('Safepay tracker response is invalid');

    const passportResponse = await this.fetchImpl(`${apiBase(this.options.environment)}/client/passport/v1/token`, {
      method: 'POST',
      headers: this.secretHeaders(true),
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    if (!passportResponse.ok) throw new Error('Safepay authentication token creation failed');
    const passportPayload = (await passportResponse.json()) as PassportResponse;
    if (passportPayload.status?.errors?.length) throw new Error('Safepay authentication token creation failed');
    const tbt = (typeof passportPayload.data === 'string'
      ? passportPayload.data
      : passportPayload.data?.token ?? passportPayload.data?.tbt)?.trim();
    if (!tbt) throw new Error('Safepay authentication token response is invalid');

    const checkout = new URL(checkoutBase(this.options.environment));
    checkout.searchParams.set('environment', this.options.environment);
    checkout.searchParams.set('tracker', token);
    checkout.searchParams.set('tbt', tbt);
    checkout.searchParams.set('source', 'hosted');
    checkout.searchParams.set('webhooks', 'true');
    checkout.searchParams.set('redirect_url', input.returnUrl);
    checkout.searchParams.set('cancel_url', input.cancelUrl);

    return { providerReference: token, checkoutUrl: checkout.toString() };
  }

  async verifyTracker(input: {
    providerReference: string;
    amountMinor: number;
    currency: string;
  }): Promise<boolean> {
    const providerReference = input.providerReference.trim();
    if (!providerReference.startsWith('track_')) return false;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return false;
    const currency = input.currency.trim().toUpperCase();
    assertCurrency(currency);

    const response = await this.fetchImpl(
      `${apiBase(this.options.environment)}/reporter/api/v1/payments/${encodeURIComponent(providerReference)}`,
      { headers: this.secretHeaders(), cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Safepay tracker verification failed');
    const payload = (await response.json()) as TrackerLookupResponse;
    if (payload.status?.errors?.length) throw new Error('Safepay tracker verification failed');
    const tracker = unwrapTracker(payload.data);
    if (!tracker) return false;
    if (tracker.token?.trim() && tracker.token.trim() !== providerReference) return false;
    const client = merchantClient(tracker.client);
    if (client && client !== this.options.apiKey) return false;
    if (tracker.state?.trim().toUpperCase() !== 'TRACKER_ENDED') return false;

    const quote = tracker.purchase_totals?.quote_amount;
    if (!quote?.currency?.trim() || quote.amount === undefined) return false;
    if (!Number.isSafeInteger(quote.amount) || quote.amount <= 0) return false;
    const trackerCurrency = quote.currency.trim().toUpperCase();
    assertCurrency(trackerCurrency);
    return trackerCurrency === currency && quote.amount === input.amountMinor;
  }

  verifyWebhook(input: { rawBody: string; headers: Headers }): VerifiedPaymentEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody) as unknown;
    } catch {
      throw new Error('Safepay webhook body is invalid');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Safepay webhook body is invalid');
    }
    const body = parsed as V2WebhookBody | { data?: LegacyWebhookData };

    const provided = input.headers.get('x-sfpy-signature')?.trim() ?? '';
    const isV2 = 'version' in body || ('type' in body && typeof body.type === 'string' && body.type.includes('.'));

    if (isV2) {
      const event = body as V2WebhookBody;
      const expected = createHmac('sha512', this.options.webhookSecret)
        .update(Buffer.from(input.rawBody))
        .digest('hex');
      if (!safeEqualHex(expected, provided)) throw new Error('Safepay webhook signature is invalid');
      if (event.version !== '2.0.0') throw new Error('Safepay webhook version is unsupported');
      if (event.merchant_api_key !== this.options.apiKey) throw new Error('Safepay webhook merchant does not match');

      const providerEventId = event.token?.trim();
      const eventType = event.type?.trim();
      const data = event.data;
      const providerReference = data?.tracker?.trim();
      const currency = data?.currency?.trim().toUpperCase();
      if (!providerEventId || !eventType || !data || !providerReference || !currency) {
        throw new Error('Safepay webhook payload is incomplete');
      }
      assertCurrency(currency);
      const providerState = stateFromV2Type(eventType);
      const amount = providerState === 'REFUNDED' ? data.refund_amount ?? data.amount : data.amount;
      if (!Number.isSafeInteger(amount) || Number(amount) <= 0) throw new Error('Safepay webhook amount is invalid');

      return {
        providerEventId,
        providerReference,
        state: providerState,
        amountMinor: Number(amount),
        currency,
        reference: metadataReference(data.metadata),
        occurredAt: parseTimestamp(data.refunded_at, data.charged_at, data.failed_at, event.created_at),
      };
    }

    // Transitional compatibility for already-created v1 trackers. New checkout sessions never use this format.
    const legacy = body as { data?: LegacyWebhookData };
    const data = legacy.data;
    if (!data || typeof data !== 'object') throw new Error('Safepay webhook data is missing');
    const expected = createHmac('sha512', this.options.webhookSecret)
      .update(Buffer.from(JSON.stringify(data)))
      .digest('hex');
    if (!safeEqualHex(expected, provided)) throw new Error('Safepay webhook signature is invalid');
    if (!data.client_id || data.client_id !== this.options.apiKey) throw new Error('Safepay webhook merchant does not match');
    if (!data.type?.trim().toLowerCase().startsWith('payment:')) throw new Error('Safepay webhook event type is unsupported');

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
