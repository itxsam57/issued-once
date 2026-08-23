import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  ContactRuntimeUnavailableError,
  createShippingService,
} from '@/server/contact/runtimeContact';

const schema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(180),
  line2: z.string().trim().max(180).default(''),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).default(''),
  postalCode: z.string().trim().min(1).max(40),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/),
  phone: z.string().trim().max(40).default(''),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Check the shipping address' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    return Response.json(await createShippingService().save({
      experienceToken: token,
      address: parsed.data,
    }));
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      return Response.json({ error: 'Shipping is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /verified contact|stage|locked|not found|shipping/i.test(error.message)) {
      return Response.json({ error: 'Shipping details could not be saved' }, { status: 409 });
    }
    console.error('shipping save failed', error);
    return Response.json({ error: 'Shipping details failed' }, { status: 500 });
  }
}
