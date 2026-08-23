import { z } from 'zod';

const envelopeSchema = z.object({
  id: z.string().min(1),
  webhookId: z.string().min(1),
  shopId: z.string().min(1),
  type: z.string().min(1),
  apiVersion: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  testMode: z.boolean(),
  data: z
    .object({
      id: z.string().min(1),
      metadata: z.record(z.string(), z.unknown()).default({}),
    })
    .passthrough(),
}).passthrough();

export type FourthwallWebhookEnvelope = {
  id: string;
  webhookId: string;
  shopId: string;
  type: string;
  apiVersion: string;
  createdAt: string;
  testMode: boolean;
  orderId: string;
  metadata: Record<string, string>;
};

export function parseFourthwallWebhookEnvelope(
  rawBody: Uint8Array,
): FourthwallWebhookEnvelope {
  const decoded = Buffer.from(rawBody).toString('utf8');
  const parsed = envelopeSchema.parse(JSON.parse(decoded));

  const metadata = Object.fromEntries(
    Object.entries(parsed.data.metadata).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

  return {
    id: parsed.id,
    webhookId: parsed.webhookId,
    shopId: parsed.shopId,
    type: parsed.type,
    apiVersion: parsed.apiVersion,
    createdAt: parsed.createdAt,
    testMode: parsed.testMode,
    orderId: parsed.data.id,
    metadata,
  };
}
