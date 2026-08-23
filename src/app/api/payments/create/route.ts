import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createPaymentService,
  PaymentRuntimeUnavailableError,
} from '@/server/payments/runtimePayments';
import { PreviewPaymentStartService } from '@/server/preview/PreviewPaymentStartService';

const schema = z.object({
  quoteId: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid payment request' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    if (process.env.ENABLE_VISUAL_PREVIEW === '1') {
      const result = await new PreviewPaymentStartService().start({
        sessionToken,
        quoteId: parsed.data.quoteId,
      });
      return Response.json(result);
    }

    const origin = new URL(request.url).origin;
    const result = await createPaymentService().start({
      sessionToken,
      quoteId: parsed.data.quoteId,
      returnBaseUrl: origin,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PaymentRuntimeUnavailableError) {
      return Response.json({ error: 'Payment is unavailable' }, { status: 503 });
    }
    if (
      error instanceof Error &&
      /experience|payment is not unlocked|quote|verified contact|shipping|checkout has already started|initialization/i.test(error.message)
    ) {
      return Response.json({ error: 'Payment state conflict' }, { status: 409 });
    }
    console.error('payment start failed', error);
    return Response.json({ error: 'Payment could not be opened' }, { status: 500 });
  }
}
