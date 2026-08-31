import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  ContactRuntimeUnavailableError,
  createContactService,
} from '@/server/contact/runtimeContact';
import {
  CONTACT_CONTINUITY_COOKIE_NAME,
  contactContinuityCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/server/http/sessionCookie';

const schema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const experienceToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!experienceToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }
  const continuityToken = cookieStore.get(CONTACT_CONTINUITY_COOKIE_NAME)?.value;

  try {
    const result = await createContactService().reuseVerified({
      experienceToken,
      email: parsed.data.email,
      continuityToken,
    });
    cookieStore.set(
      CONTACT_CONTINUITY_COOKIE_NAME,
      '',
      { ...contactContinuityCookieOptions, maxAge: 0 },
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      return Response.json({ error: 'Contact verification is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /verified email reuse is not available/i.test(error.message)) {
      return Response.json({ error: 'Verified email reuse is not available' }, { status: 409 });
    }
    if (error instanceof Error && /experience not found/i.test(error.message)) {
      return Response.json({ error: 'Verified email reuse is not available' }, { status: 409 });
    }
    console.error('verified contact reuse failed');
    return Response.json({ error: 'Contact verification failed' }, { status: 500 });
  }
}
