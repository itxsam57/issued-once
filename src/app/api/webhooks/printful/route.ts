import {
  createManufacturingEventService,
  ManufacturingRuntimeUnavailableError,
} from '@/server/manufacturing/runtimeManufacturing';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await createManufacturingEventService().handle({
      rawBody,
      headers: request.headers,
    });

    if (
      result.issueId &&
      (result.kind === 'applied' || result.kind === 'duplicate')
    ) {
      if (result.eventType === 'SHIPMENT_SENT') {
        await enqueueIssueNotification(result.issueId, 'SHIPPED');
      } else if (result.eventType === 'SHIPMENT_DELIVERED') {
        await enqueueIssueNotification(result.issueId, 'DELIVERED');
      }
    }

    return Response.json({ received: true, kind: result.kind });
  } catch (error) {
    if (error instanceof ManufacturingRuntimeUnavailableError) {
      return Response.json({ error: 'Manufacturing webhook is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /signature|public key/i.test(error.message)) {
      return Response.json({ error: 'Webhook authentication failed' }, { status: 401 });
    }
    if (error instanceof Error && /cross-link|mismatch/i.test(error.message)) {
      return Response.json({ error: 'Webhook identity mismatch' }, { status: 409 });
    }
    if (error instanceof Error && /json|unsupported|invalid/i.test(error.message)) {
      return Response.json({ error: 'Webhook payload is invalid' }, { status: 400 });
    }
    console.error('printful webhook processing failed');
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
