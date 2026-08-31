import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import { createSupportService, SupportRuntimeUnavailableError } from '@/server/support/runtimeSupport';

const schema = z.object({ message: z.string().trim().min(2).max(5000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Write a little more so we know what happened.' }, { status: 400 });

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ error: 'Your Issue session is required.' }, { status: 401 });

  try {
    const result = await createSupportService().create({
      sessionToken: token,
      message: parsed.data.message,
    });
    return Response.json({ received: true, issueCode: result.issueCode });
  } catch (error) {
    if (error instanceof SupportRuntimeUnavailableError) {
      return Response.json({ error: 'Support is unavailable right now.' }, { status: 503 });
    }
    if (error instanceof Error && /issue|required|message/i.test(error.message)) {
      return Response.json({ error: 'This Issue could not be attached to support.' }, { status: 409 });
    }
    console.error('support request failed');
    return Response.json({ error: 'Support request failed.' }, { status: 500 });
  }
}
