import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const webhookSchema = z.object({
  type: z.string(),
  occurred_at: z.string().datetime(),
  retries: z.number().int().nonnegative(),
  store_id: z.number().int(),
  data: z.object({
    shipment: z.object({
      id: z.union([z.number(), z.string()]),
      tracking_number: z.string().nullable().optional(),
      tracking_url: z.string().nullable().optional(),
      shipped_at: z.string().nullable().optional(),
      delivered_at: z.string().nullable().optional(),
    }).optional(),
    order: z.object({
      id: z.union([z.number(), z.string()]),
      external_id: z.string().nullable().optional(),
      status: z.string().optional(),
    }),
    reason: z.string().optional(),
  }),
});

export type NormalizedPrintfulEvent = {
  providerEventId: string;
  type: 'SHIPMENT_SENT' | 'SHIPMENT_DELIVERED' | 'SHIPMENT_CANCELED' | 'ORDER_FAILED' | 'ORDER_CANCELED' | 'ORDER_UPDATED';
  providerOrderId: string;
  externalIssueCode: string | null;
  providerStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  occurredAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  reason: string | null;
};

type Options = { publicKey: string; secretKeyHex: string };

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/i.test(right) || left.length !== right.length) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeType(value: string): NormalizedPrintfulEvent['type'] {
  switch (value) {
    case 'shipment_sent': return 'SHIPMENT_SENT';
    case 'shipment_delivered': return 'SHIPMENT_DELIVERED';
    case 'shipment_canceled': return 'SHIPMENT_CANCELED';
    case 'order_failed': return 'ORDER_FAILED';
    case 'order_canceled': return 'ORDER_CANCELED';
    case 'order_updated': return 'ORDER_UPDATED';
    default: throw new Error('Unsupported Printful webhook event');
  }
}

export class PrintfulWebhookVerifier {
  private readonly secret: Buffer;

  constructor(private readonly options: Options) {
    if (!options.publicKey.trim()) throw new Error('Printful webhook public key is required');
    if (!/^[0-9a-f]+$/i.test(options.secretKeyHex) || options.secretKeyHex.length % 2 !== 0) {
      throw new Error('Printful webhook secret must be hexadecimal');
    }
    this.secret = Buffer.from(options.secretKeyHex, 'hex');
    if (this.secret.length < 32) throw new Error('Printful webhook secret must be at least 32 bytes');
  }

  verify(input: { rawBody: string; headers: Headers }): NormalizedPrintfulEvent {
    const publicKey = input.headers.get('x-pf-webhook-public-key')?.trim() ?? '';
    if (publicKey !== this.options.publicKey) throw new Error('Printful webhook public key is invalid');
    const provided = input.headers.get('x-pf-webhook-signature')?.trim() ?? '';
    const expected = createHmac('sha256', this.secret).update(input.rawBody).digest('hex');
    if (!safeHexEqual(expected, provided)) throw new Error('Printful webhook signature is invalid');

    let raw: unknown;
    try { raw = JSON.parse(input.rawBody); } catch { throw new Error('Printful webhook JSON is invalid'); }
    const event = webhookSchema.parse(raw);
    const type = normalizeType(event.type);
    const shipment = event.data.shipment;
    const providerOrderId = String(event.data.order.id);
    const stableIdentity = [
      event.type,
      event.occurred_at,
      event.store_id,
      providerOrderId,
      shipment ? String(shipment.id) : '-',
    ].join('|');
    const providerEventId = createHash('sha256').update(stableIdentity, 'utf8').digest('hex');

    return {
      providerEventId,
      type,
      providerOrderId,
      externalIssueCode: event.data.order.external_id?.trim() || null,
      providerStatus: event.data.order.status?.trim() || null,
      trackingNumber: shipment?.tracking_number?.trim() || null,
      trackingUrl: shipment?.tracking_url?.trim() || null,
      occurredAt: new Date(event.occurred_at),
      shippedAt: dateOrNull(shipment?.shipped_at),
      deliveredAt: dateOrNull(shipment?.delivered_at),
      reason: event.data.reason?.trim() || null,
    };
  }
}
