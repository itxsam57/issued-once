import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import {
  createSizeSelectionService,
  PhysicalRuntimeUnavailableError,
} from '@/server/physical/runtimePhysical';

const sizeSelectionSchema = z.object({
  sizeCode: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  const parsed = sizeSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid size payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }

  try {
    const result = await createSizeSelectionService().confirm({
      sessionToken,
      sizeCode: parsed.data.sizeCode,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PhysicalRuntimeUnavailableError) {
      return Response.json({ error: 'Size selection is unavailable' }, { status: 503 });
    }

    if (
      error instanceof Error &&
      /experience not found|not unlocked|physical selection not found|unavailable|no available base colors|stage conflict/i.test(
        error.message,
      )
    ) {
      return Response.json({ error: 'Size selection state conflict' }, { status: 409 });
    }

    console.error('physical size selection failed');
    return Response.json({ error: 'Size could not be confirmed' }, { status: 500 });
  }
}
