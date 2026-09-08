import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createObjectSelectionService,
  PhysicalRuntimeUnavailableError,
} from '@/server/physical/runtimePhysical';

const objectSelectionSchema = z.object({
  object: z.enum(['tee', 'hoodie', 'hat', 'tote']),
});

export async function POST(request: Request) {
  const parsed = objectSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid physical form payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const result = await createObjectSelectionService().select({
      sessionToken,
      object: parsed.data.object,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PhysicalRuntimeUnavailableError) {
      return Response.json({ error: 'Physical form is unavailable' }, { status: 503 });
    }

    if (
      error instanceof Error &&
      /experience not found|not unlocked|no available sizes|stage conflict|not configured/i.test(error.message)
    ) {
      return Response.json({ error: 'Physical form state conflict' }, { status: 409 });
    }

    console.error('physical object selection failed');
    return Response.json({ error: 'Physical form could not be locked' }, { status: 500 });
  }
}
