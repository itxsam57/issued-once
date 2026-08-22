import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createBaseSelectionService,
  PhysicalRuntimeUnavailableError,
} from '@/server/physical/runtimePhysical';

const baseSelectionSchema = z.object({
  colorCode: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const parsed = baseSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid base payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const result = await createBaseSelectionService().confirm({
      sessionToken,
      colorCode: parsed.data.colorCode,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PhysicalRuntimeUnavailableError) {
      return Response.json({ error: 'Base selection is unavailable' }, { status: 503 });
    }

    if (
      error instanceof Error &&
      /experience not found|not unlocked|physical selection not found|confirmed size is missing|unavailable|ambiguous|stage conflict/i.test(
        error.message,
      )
    ) {
      return Response.json({ error: 'Base selection state conflict' }, { status: 409 });
    }

    console.error('physical base selection failed', error);
    return Response.json({ error: 'Base could not be confirmed' }, { status: 500 });
  }
}
