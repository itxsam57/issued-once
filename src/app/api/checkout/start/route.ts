import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  CheckoutRuntimeUnavailableError,
  createCheckoutStartService,
} from '@/server/checkout/runtimeCheckout';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';

const checkoutStartSchema = z.object({
  quoteId: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = checkoutStartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid checkout payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Checkout session is required' }, { status: 401 });
  }

  try {
    const service = createCheckoutStartService();
    const result = await service.start({
      sessionToken,
      quoteId: parsed.data.quoteId,
    });

    return Response.json({ checkoutUrl: result.checkoutUrl });
  } catch (error) {
    if (error instanceof CheckoutRuntimeUnavailableError) {
      return Response.json({ error: 'Checkout is unavailable' }, { status: 503 });
    }

    if (
      error instanceof Error &&
      /experience not found|quote not found|does not belong|expired|variant unavailable|quote changed/i.test(
        error.message,
      )
    ) {
      return Response.json({ error: 'Checkout state conflict' }, { status: 409 });
    }

    console.error('checkout start failed', error);
    return Response.json({ error: 'Checkout could not be opened' }, { status: 500 });
  }
}
