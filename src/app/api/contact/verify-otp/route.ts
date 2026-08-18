import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  ContactRuntimeUnavailableError,
  createContactService,
} from '@/server/contact/runtimeContact';

const schema = z.object({
  challengeId: z.string().min(1).max(100),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter the six-digit code' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    return Response.json(await createContactService().verifyOtp({
      experienceToken: token,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
    }));
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      return Response.json({ error: 'Contact verification is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /attempt limit/i.test(error.message)) {
      return Response.json({ error: 'That code can no longer be used. Request another.' }, { status: 429 });
    }
    if (error instanceof Error && /expired|used|code|challenge|not found/i.test(error.message)) {
      return Response.json({ error: 'That code could not be verified' }, { status: 409 });
    }
    console.error('contact otp verification failed', error);
    return Response.json({ error: 'Contact verification failed' }, { status: 500 });
  }
}
