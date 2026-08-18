import {
  createManufacturingEventService,
  ManufacturingRuntimeUnavailableError,
} from '@/server/manufacturing/runtimeManufacturing';

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await createManufacturingEventService().handle({
      rawBody,
      headers: request.headers,
    });
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
    console.error('printful webhook processing failed', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
