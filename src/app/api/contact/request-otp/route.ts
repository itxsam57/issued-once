import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  ContactRuntimeUnavailableError,
  createContactService,
} from '@/server/contact/runtimeContact';

const schema = z.object({
  email: z.string().trim().email().max(320),
});

function riskKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const result = await createContactService().requestOtp({
      experienceToken: token,
      email: parsed.data.email,
      ipKey: riskKey(request),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ContactRuntimeUnavailableError) {
      return Response.json({ error: 'Contact verification is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /wait|resend/i.test(error.message)) {
      return Response.json({ error: 'A code was sent recently. Try again shortly.' }, { status: 429 });
    }
    if (error instanceof Error && /not found|stage|email/i.test(error.message)) {
      return Response.json({ error: 'Contact verification could not be started' }, { status: 409 });
    }
    console.error('contact otp request failed', error);
    return Response.json({ error: 'Contact verification failed' }, { status: 500 });
  }
}
