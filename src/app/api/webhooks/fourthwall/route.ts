import { RetryablePaidOrderError } from '@/server/issues/PaidOrderWebhookService';
import {
  createPaidOrderRuntime,
  PaidOrderRuntimeUnavailableError,
} from '@/server/issues/runtimePaidOrders';
import { parseFourthwallWebhookEnvelope } from '@/server/webhooks/FourthwallWebhookEnvelope';
import { verifyFourthwallWebhookSignature } from '@/server/webhooks/FourthwallWebhookSignature';

export async function POST(request: Request) {
  let runtime;
  try {
    runtime = createPaidOrderRuntime();
  } catch (error) {
    if (error instanceof PaidOrderRuntimeUnavailableError) {
      return Response.json({ error: 'Webhook runtime is unavailable' }, { status: 503 });
    }
    throw error;
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get('x-fourthwall-hmac-sha256') ?? '';

  if (!verifyFourthwallWebhookSignature(rawBody, signature, runtime.webhookSecret)) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let envelope;
  try {
    envelope = parseFourthwallWebhookEnvelope(rawBody);
  } catch {
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  if (
    envelope.shopId !== runtime.shopId ||
    envelope.type !== 'ORDER_PLACED' ||
    envelope.apiVersion !== runtime.apiVersion
  ) {
    return Response.json({ status: 'ignored' });
  }

  try {
    const outcome = await runtime.service.process(envelope);
    return Response.json({ status: outcome.kind });
  } catch (error) {
    if (error instanceof RetryablePaidOrderError) {
      return Response.json({ error: 'Webhook processing is retryable' }, { status: 503 });
    }

    console.error('Fourthwall webhook processing failed');
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
